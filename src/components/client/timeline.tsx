import { AuthorType, MessageKind } from "@prisma/client";
import Link from "next/link";

import { deleteMessage, togglePinMessage } from "@/app/actions/messages";
import { formatDateTime } from "@/lib/format";

const KIND_LABELS: Record<MessageKind, string> = {
  NOTE: "Poznámka",
  EMAIL: "E-mail",
  CALL: "Telefonát",
  MEETING: "Schůzka",
  PORTAL_FEEDBACK: "Připomínka z portálu",
  SYSTEM_EVENT: "Systém",
};

const KIND_CLASSES: Record<MessageKind, string> = {
  NOTE: "bg-slate-100 text-slate-600",
  EMAIL: "bg-sky-100 text-sky-700",
  CALL: "bg-violet-100 text-violet-700",
  MEETING: "bg-amber-100 text-amber-800",
  PORTAL_FEEDBACK: "bg-rose-100 text-rose-700",
  SYSTEM_EVENT: "bg-slate-100 text-slate-500",
};

export type TimelineMessage = {
  id: string;
  kind: MessageKind;
  body: string;
  pinned: boolean;
  createdAt: Date;
  editedAt: Date | null;
  authorType: AuthorType;
  authorId: string | null;
  author: { name: string } | null;
  project: { name: string } | null;
};

export function Timeline({
  messages,
  currentUserId,
  editHrefBase,
}: {
  messages: TimelineMessage[];
  currentUserId: string;
  /** Základ odkazu pro otevření úpravy zápisu, už včetně "?". */
  editHrefBase: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="font-medium text-slate-900">Zatím žádný záznam</p>
        <p className="mt-1 text-sm text-slate-500">
          Zapište první poznámku, telefonát nebo e-mail.
        </p>
      </div>
    );
  }

  // Připnuté nahoru, jinak od nejnovějšího.
  const ordered = [...messages].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <ol className="space-y-2">
      {ordered.map((message) => {
        const authorLabel =
          message.authorType === AuthorType.CLIENT
            ? "Klient"
            : message.authorType === AuthorType.SYSTEM
              ? "Systém"
              : (message.author?.name ?? "Neznámý");

        // Vlastní zápis smí autor upravit i smazat. Připomínky klienta
        // a systémové události zůstávají jako doklad.
        const canEdit =
          message.authorType === AuthorType.USER &&
          message.authorId === currentUserId;

        return (
          <li
            key={message.id}
            className={`rounded-xl border bg-white p-4 ${
              message.pinned
                ? "border-amber-300 ring-1 ring-amber-100"
                : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${KIND_CLASSES[message.kind]}`}
              >
                {KIND_LABELS[message.kind]}
              </span>
              <span className="text-slate-500">{authorLabel}</span>
              <span className="text-slate-400">·</span>
              <time className="text-slate-400">
                {formatDateTime(message.createdAt)}
              </time>
              {message.project ? (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{message.project.name}</span>
                </>
              ) : null}
              {message.editedAt ? (
                <span
                  className="text-slate-400"
                  title={`Upraveno ${formatDateTime(message.editedAt)}`}
                >
                  upraveno
                </span>
              ) : null}
              {message.pinned ? (
                <span className="text-amber-700">připnuto</span>
              ) : null}
            </div>

            <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">
              {message.body}
            </p>

            <div className="mt-3 flex items-center gap-3 text-xs">
              <form action={togglePinMessage}>
                <input type="hidden" name="messageId" value={message.id} />
                <button
                  type="submit"
                  className="text-slate-500 transition hover:text-slate-900"
                >
                  {message.pinned ? "Odepnout" : "Připnout"}
                </button>
              </form>

              {canEdit ? (
                <>
                  <Link
                    href={`${editHrefBase}&message=${message.id}`}
                    className="text-slate-500 transition hover:text-slate-900"
                  >
                    Upravit
                  </Link>

                  <form action={deleteMessage}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <button
                      type="submit"
                      className="text-slate-400 transition hover:text-red-600"
                    >
                      Smazat
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
