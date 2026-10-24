import csv
import io
import json
import zipfile

from fastapi.testclient import TestClient
import pandas as pd
import pytest
from openpyxl import Workbook

from backend.app import data
from backend.app.main import app
from backend.app.security import JSON_BODY_LIMIT, UPLOAD_BODY_LIMIT, spreadsheet_csv, spreadsheet_text
from backend.tests.client import LocalClient


@pytest.fixture(autouse=True)
def storage(tmp_path,monkeypatch):
    monkeypatch.setenv('LATENTSPACE_DATA_DIR',str(tmp_path))


@pytest.mark.parametrize('host',['evil.example','localhost.evil.example','localhost@evil.example','127.0.0.1.evil.example','localhost:bad'])
def test_foreign_and_malformed_hosts_are_rejected_before_data_access(host):
    with TestClient(app,base_url='http://localhost') as client:
        response=client.get('/api/session',headers={'Host':host})
        assert response.status_code==400 and response.json()['code']=='LOCAL_HOST'


@pytest.mark.parametrize('origin',['https://evil.example','null','http://localhost.evil.example','http://localhost:9999'])
def test_foreign_origins_cannot_read_tokens_or_datasets(origin):
    with TestClient(app,base_url='http://localhost') as client:
        response=client.get('/api/session',headers={'Origin':origin})
        assert response.status_code==403 and response.json()['code']=='LOCAL_ORIGIN'
        assert client.get('/api/datasets',headers={'Origin':origin}).status_code==403


def test_same_origin_mutations_need_token_and_cross_site_cannot_use_it():
    with TestClient(app,base_url='http://localhost') as client:
        session=client.get('/api/session',headers={'Origin':'http://localhost'})
        token=session.json()['token']
        assert session.headers['Cache-Control']=='no-store'
        assert session.headers['X-Content-Type-Options']=='nosniff'
        assert "frame-ancestors 'none'" in session.headers['Content-Security-Policy']
        assert client.delete('/api/datasets/missing').status_code==403
        assert client.delete('/api/datasets/missing',headers={'X-LatentSpace-Token':'invalid'}).status_code==403
        assert client.delete('/api/datasets/missing',headers={'X-LatentSpace-Token':b'\xff'}).status_code==403
        assert client.delete('/api/datasets/missing',headers={'X-LatentSpace-Token':token}).status_code==404
        assert client.get('/api/session',headers={'Sec-Fetch-Site':'cross-site'}).status_code==403
        assert client.delete('/api/datasets/missing',headers={'X-LatentSpace-Token':token,'Origin':'https://evil.example'}).status_code==403
        assert client.options('/api/datasets',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'POST'}).status_code==403


def test_development_origin_has_no_wildcard_cors():
    with LocalClient(app) as client:
        assert client.get('/api/session',headers={'Origin':'http://localhost:5173'}).status_code==200
        assert 'Access-Control-Allow-Origin' not in client.get('/api/session').headers
        assert client.post('/api/datasets/demo?kind=missing').status_code==422


@pytest.mark.parametrize('path,limit',[('/api/datasets',UPLOAD_BODY_LIMIT),('/api/analyses/missing/explore',JSON_BODY_LIMIT)])
def test_declared_large_body_is_rejected_before_reading(path,limit):
    with LocalClient(app) as client:
        response=client.post(path,content=b'',headers={'Content-Length':str(limit+1)})
        assert response.status_code==413 and response.json()['code']=='BODY_LIMIT'


def test_streamed_json_is_bounded_even_without_content_length():
    with LocalClient(app) as client:
        response=client.post('/api/analyses/missing/explore',content=(chunk for chunk in [b'{"query":"',b'x'*(JSON_BODY_LIMIT+1),b'"}']),headers={'Content-Type':'application/json'})
        assert response.status_code==413


@pytest.mark.parametrize('value',['=1+1','+SUM(A1)','-1+2','@SUM(A1)','  =1+1','\ufeff=1+1','\u200b@x','＝1+1','＋1','\ttext','\rtext','\ntext','a,"\n=1+1'])
def test_csv_protection_preserves_cell_boundaries_and_guards_formula_prefixes(value):
    frame=pd.DataFrame({value:[value],'Safe':[-5]})
    before=frame.copy(deep=True)
    content,mapping=spreadsheet_csv(frame)
    records=list(csv.reader(io.StringIO(content.decode('utf-8-sig'))))
    assert len(records)==2 and all(len(row)==2 for row in records)
    assert records[0][0]==spreadsheet_text(value) and records[1][0]==spreadsheet_text(value)
    if not value.startswith('a,'): assert records[0][0].startswith('\t')
    assert records[1][1]=='-5'
    assert json.loads(mapping)[0]['source']==value
    pd.testing.assert_frame_equal(frame,before)


def test_escaped_headers_stay_unique_and_expose_mapping():
    frame=pd.DataFrame([[1,2]],columns=['=x','\t=x'])
    content,mapping=spreadsheet_csv(frame)
    headers=next(csv.reader(io.StringIO(content.decode('utf-8-sig'))))
    assert len(set(headers))==2
    assert [item['exported'] for item in json.loads(mapping)]==headers


def test_limits_are_enforced_before_dataframe_allocation(monkeypatch):
    def forbidden(*args,**kwargs): raise AssertionError('DataFrame was allocated before limit validation')
    monkeypatch.setattr(data.pd,'DataFrame',forbidden)
    with pytest.raises(ValueError,match='höchstens'):
        data.import_file(('A\n'+'1\n'*(data.MAX_ROWS+1)).encode(),'large.csv')
    with pytest.raises(ValueError,match='höchstens'):
        data.import_file((','.join(f'C{i}' for i in range(data.MAX_COLUMNS+1))+'\n').encode(),'wide.csv')


def test_excel_dimensions_are_rejected_early_and_cannot_silently_truncate():
    book=Workbook(); sheet=book.active
    sheet.append(['A','B']);sheet.append([1,2]);sheet.append([3,4]);source=io.BytesIO();book.save(source)
    for ref,expected_rows in [('A1:CC3',None),('A1:A1',2)]:
        out=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(source.getvalue())) as original, zipfile.ZipFile(out,'w') as revised:
            for entry in original.infolist():
                content=original.read(entry.filename)
                if entry.filename=='xl/worksheets/sheet1.xml': content=content.replace(b'ref="A1:B3"',f'ref="{ref}"'.encode())
                revised.writestr(entry,content)
        if expected_rows is None:
            with pytest.raises(ValueError,match='höchstens'):data.import_file(out.getvalue(),'wide.xlsx')
        else:
            meta=data.import_file(out.getvalue(),'dishonest.xlsx')
            assert meta['row_count']==expected_rows and len(meta['columns'])==2


def test_oversize_cell_and_ragged_csv_are_not_silently_truncated():
    with pytest.raises(ValueError):data.import_file(b'A,B\n1,2,3\n','ragged.csv')
    with pytest.raises(ValueError,match='Zellgröße'):data.import_file(('A\n'+'x'*(data.MAX_CELL_CHARS+1)).encode(),'cell.csv')
