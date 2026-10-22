import { Bookmark, FolderOpen, Trash2 } from "lucide-react";
import { api } from "../api";
import type { ResearchRecord } from "../api";
export default function ResearchShelf({
  records,
  onOpen,
  onRefresh,
  onError,
}: {
  records: ResearchRecord[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
}) {
  const findings = records.filter((record) => record.kind === "finding");
  async function remove(id: string) {
    try {
      await api(`/research/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      onError((error as Error).message);
    }
  }
  return (
    <section className="research-shelf">
      <div className="section-heading">
        <div>
          <h2>
            <Bookmark size={18} /> Gespeicherte Befunde
          </h2>
          <p>
            Feste Referenzen und Notizen bleiben nach einem Neustart erhalten.
          </p>
        </div>
        <span>{findings.length} gespeichert</span>
      </div>
      {findings.length ? (
        <div className="research-list">
          {findings.map((record) => (
            <article key={record.id}>
              <button className="text-button" onClick={() => onOpen(record.id)}>
                <FolderOpen size={16} />
                {record.name}
              </button>
              {record.notes && <p>{record.notes}</p>}
              <small>
                {new Date(record.created_at).toLocaleString("de-DE")}
              </small>
              <button
                className="icon-button"
                aria-label={`Gespeicherten Befund ${record.name} löschen`}
                onClick={() => void remove(record.id)}
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p>
          Öffne einen Befund und speichere ihn mit deiner fachlichen Einordnung.
        </p>
      )}
    </section>
  );
}
