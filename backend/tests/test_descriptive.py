import copy
import json

import numpy as np
import pandas as pd
import pytest

from backend.app import research
from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import import_file, load_dataset, save_dataset
from backend.app.findings import investigate, require_finding
from backend.app.insights import build_profile
from backend.app.main import app, jobs, lock
from backend.app.presentation import date_series
from backend.app.reports import build_report, markdown_report
from backend.app.sensitivity import correlation_loo, median_loo
from backend.tests.client import LocalClient
from backend.validation.null_suite import DISTRIBUTIONS, null_frame, search


@pytest.fixture(autouse=True)
def storage(tmp_path,monkeypatch):
    monkeypatch.setenv('LATENTSPACE_DATA_DIR',str(tmp_path))


def run(frame,**options):
    meta=save_dataset(frame,'independent.csv')
    return analyze(load_dataset(meta['id']),AnalysisRequest(**options))


def test_dates_require_explicit_interpretation_and_keep_source():
    meta=import_file(b'Date,Value\n01/02/2026,1\n03/04/2026,2\n','ambiguous.csv')
    assert meta['columns'][0]['date_ambiguous']
    payload=load_dataset(meta['id'])
    with pytest.raises(ValueError,match='Mehrdeutiges Datum'):
        analyze(payload,AnalysisRequest())
    dmy=analyze(payload,AnalysisRequest(display={'Date':{'date_format':'dmy'}}))
    mdy=analyze(payload,AnalysisRequest(display={'Date':{'date_format':'mdy'}}))
    assert dmy['_frame'].Date.iloc[0].month==2
    assert mdy['_frame'].Date.iloc[0].month==1
    assert dmy['config']['display']['Date']['date_format']=='dmy'
    assert [row['values'] for row in dmy['rows']]==payload['rows']
    with LocalClient(app) as client:
        response=client.post(f"/api/datasets/{meta['id']}/analyses",json={})
        assert response.status_code==422
        assert 'Date' in response.json()['detail']


@pytest.mark.parametrize('form,text,expected',[('dmy','13/02/2026',2),('mdy','02/13/2026',2),('iso','2026-2-13',2)])
def test_explicit_date_format_does_not_fallback_to_another_local_order(form,text,expected):
    series=date_series(pd.Series([text,'2026-02-14','invalid','02/30/2026']),form)
    assert series.iloc[0].month==expected
    assert series.iloc[1].day==14
    assert series.iloc[2:].isna().all()
    wrong='mdy' if form=='dmy' else 'dmy'
    if form!='iso': assert date_series(pd.Series([text]),wrong).isna().all()


def test_month_labels_are_user_choice_independent_of_names_and_keep_rules():
    frame=pd.DataFrame({'Monat':[1]*12+[2]*12+[11]*2,'Code':[1]*12+[2]*12+[11]*2})
    baseline=run(frame)
    chosen=run(frame,display={'Code':{'month_base':'zero','unit_label':'custom'}})
    a,b=explore(baseline,ExploreRequest()),explore(chosen,ExploreRequest())
    assert all(profile['distribution_kind']!='month_codes' for profile in a['profiles'])
    profile=next(p for p in b['profiles'] if p['name']=='Code')
    assert profile['distribution'][0]['label']=='Februar'
    assert profile['unit_label']=='custom'
    assert {i['id'] for i in a['insights']}=={i['id'] for i in b['insights']}
    finding=next(i for i in b['insights'] if i['id']=='range:Code')
    detail=investigate(chosen,require_finding(chosen,finding['token']))
    assert detail['distribution'][0]['label']=='Februar'
    with pytest.raises(ValueError,match='Monatskodierung'):
        run(pd.DataFrame({'Arbitrary':[0,12]}),display={'Arbitrary':{'month_base':'zero'}})


def test_basis_freezes_filters_conversions_missingness_and_procedure():
    result=run(pd.DataFrame({'X':['1','invalid',None,'3','4','5'],'G':['A']*4+['B']*2}),roles={'X':'number'})
    first=explore(result,ExploreRequest(category_column='G',category_value='A'))
    finding=next(i for i in first['insights'] if i['id']=='missing:X')
    basis=copy.deepcopy(finding['basis'])
    assert basis['reference_rows']==4 and basis['dataset_rows']==6 and basis['complete_rows']==2
    assert basis['columns'][0]['source_missing']==1 and basis['columns'][0]['conversion_missing']==1
    assert basis['filters']==['G = A'] and finding['result_type']=='observation'
    explore(result,ExploreRequest(category_column='G',category_value='B'))
    assert investigate(result,require_finding(result,finding['token']))['finding']['basis']==basis
    report=build_report(result,ExploreRequest(category_column='G',category_value='A'))
    assert report['finding_selection']['shown']==len(report['insights'])
    assert 'Filter: G = A' in markdown_report(report)
    assert all('priority' not in item for item in report['insights'])


def test_model_basis_lists_training_features_and_separate_selection():
    result=run(pd.DataFrame({'X':range(100),'Y':[None]+list(range(99))}))
    result['rows'][0]['anomaly']=True
    finding=next(i for i in explore(result,ExploreRequest(row_ids=[0]))['insights'] if i['id']=='model:anomalies')
    assert finding['result_type']=='model' and finding['columns']==result['features']
    assert finding['basis']['model_training_rows']==100
    assert finding['basis']['reference_rows']==1
    assert next(c for c in finding['basis']['columns'] if c['name']=='Y')['source_missing']==1


def test_paging_sorting_and_filters_only_change_display_not_candidate_count():
    result=run(pd.DataFrame({f'X{i:02}':np.arange(100)*(i+1) for i in range(9)}))
    a=explore(result,ExploreRequest(finding_limit=10,finding_sort='strength',finding_direction='desc'))
    b=explore(result,ExploreRequest(finding_limit=10,finding_offset=10,finding_sort='strength',finding_direction='desc'))
    assert a['coverage']['candidates']>40 and len(a['insights'])==10
    assert a['coverage']['candidates']==b['coverage']['candidates']
    assert not {i['id'] for i in a['insights']} & {i['id'] for i in b['insights']}
    all_pages=explore(result,ExploreRequest(finding_limit=100,finding_sort='strength',finding_direction='desc'))['insights']
    measured=[i['metrics']['strength']['value'] for i in all_pages if i['metrics']['strength']]
    assert measured==sorted(measured,reverse=True)
    selected=explore(result,ExploreRequest(finding_origin='model',finding_kind='anomaly'))
    assert all(i['result_type']=='model' for i in selected['insights'])
    assert selected['coverage']['candidates']==a['coverage']['candidates']
    assert selected['coverage']['matched']==1


@pytest.mark.parametrize('n',[3,4,5,10,51])
def test_exact_leave_one_out_matches_independent_recomputation(n):
    rng=np.random.default_rng(n)
    frame=pd.DataFrame({'X':rng.normal(size=n),'Y':rng.normal(size=n)},index=np.arange(n)*3)
    full=frame.X.median()
    median=median_loo(frame.X)
    brute=[frame.X.drop(index=i).median() for i in frame.index]
    assert median['minimum']==pytest.approx(min(brute)) and median['maximum']==pytest.approx(max(brute))
    for change in median['largest_changes']:
        assert change['without']==pytest.approx(frame.X.drop(index=change['row_id']).median())
        assert change['difference']==pytest.approx(change['without']-full)
    if n>=4:
        pair=correlation_loo(frame,'X','Y')
        brute=[frame.drop(index=i).X.corr(frame.drop(index=i).Y) for i in frame.index]
        assert pair['minimum']==pytest.approx(min(brute)) and pair['maximum']==pytest.approx(max(brute))


def test_undefined_correlation_is_reported_not_invented():
    frame=pd.DataFrame({'X':[0.,0.,0.,1.],'Y':[0.,1.,2.,3.]})
    assert correlation_loo(frame,'X','Y')['undefined']==1
    assert not correlation_loo(frame.iloc[:3],'X','Y')['available']
    assert not median_loo(pd.Series([np.nan,1]))['available']


def test_review_is_separate_persists_after_job_loss_and_exports_user_notes():
    result=run(pd.DataFrame({'X':np.r_[np.linspace(0,1,40),100.],'Y':np.r_[np.linspace(0,2,40),110.]}))
    finding=next(i for i in explore(result,ExploreRequest())['insights'] if i['id']=='range:X')
    snapshot=copy.deepcopy(require_finding(result,finding['token']))
    with lock: jobs['review-test']={'id':'review-test','dataset_id':result['dataset_id'],'status':'done','result':result}
    with LocalClient(app) as client:
        base=f"/api/analyses/review-test/findings/{finding['token']}"
        saved=client.post(base+'/save',json={'notes':'own assessment','review':{'column':'X','exclude_rows':[40]}})
        assert saved.status_code==201
        record=saved.json()
        with lock: jobs.pop('review-test')
        restored=client.post(f"/api/research/{record['id']}/investigate",json={}).json()
        assert restored['review']['remaining_rows']==40
        assert restored['review']['column_comparison']['after']['mean']<1
        exported=client.post(f"/api/research/{record['id']}/report").json()
        assert exported['notes_origin']=='user' and exported['review']==restored['review']
        assert exported['finding']['basis']==finding['basis']
        assert record['snapshot']==snapshot
        assert client.patch(f"/api/research/{record['id']}",json={'review':{'exclude_rows':[999]}}).status_code==422
        assert client.patch(f"/api/research/{record['id']}",json={'review':{'exclude_rows':[40,40]}}).status_code==422


def test_legacy_saved_finding_retains_reference_with_neutral_rendering():
    result=run(pd.DataFrame({'X':list(range(30))+[999]}))
    finding=next(i for i in explore(result,ExploreRequest())['insights'] if i['id']=='range:X')
    snapshot=copy.deepcopy(require_finding(result,finding['token']))
    for key in ['basis','result_type','procedure','metrics']: snapshot['finding'].pop(key)
    snapshot['finding']['priority']=99
    snapshot['analysis_config'].pop('display')
    record=research.save(result['dataset_id'],'finding',{'name':'legacy','snapshot':snapshot})
    restored,saved=research.restore_finding(record)
    detail=investigate(restored,saved)
    assert detail['reference_row_ids']==snapshot['reference_ids']
    assert detail['finding']['result_type']=='rule' and 'priority' not in detail['finding']
    assert 'basis' not in record['snapshot']['finding']


@pytest.mark.parametrize('distribution',DISTRIBUTIONS)
def test_many_independent_random_samples_keep_mathematical_rule_support(distribution):
    quartile_hits=0
    for seed in range(30):
        frame=null_frame(distribution,seed)
        for finding in search(frame):
            tag=finding['id'].split(':')[0]
            if tag=='range':
                rule=finding['cell_evidence'][0]
                values=frame[rule['column']]
                assert finding['row_ids']==values.index[(values<rule['lower'])|(values>rule['upper'])].tolist()
                quartile_hits+=len(finding['row_ids'])
            elif tag=='correlation':
                x,y=finding['columns']; pair=frame[[x,y]].dropna()
                assert len(pair)>=10 and abs(pair[x].corr(pair[y]))>=.4
            assert finding['method'] and finding['limitation']
    if distribution in {'normal','lognormal','student_t3','poisson'}: assert quartile_hits>0


def test_legacy_model_basis_restores_actual_auto_selected_features():
    result=run(pd.DataFrame({'X':list(range(30))+[999.],'Constant':[1]*31}))
    finding=next(i for i in explore(result,ExploreRequest())['insights'] if i['id']=='model:anomalies')
    snapshot=copy.deepcopy(require_finding(result,finding['token']))
    for key in ['basis','result_type','procedure','metrics']: snapshot['finding'].pop(key)
    snapshot['finding']['columns']=[]
    snapshot['analysis_config'].pop('display')
    record=research.save(result['dataset_id'],'finding',{'name':'legacy model','snapshot':snapshot})
    restored,saved=research.restore_finding(record)
    detail=investigate(restored,saved)
    assert detail['finding']['columns']==['X']
    assert detail['finding']['basis']['model_training_rows']==31
