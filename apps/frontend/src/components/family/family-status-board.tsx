"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";

// 安否の状態と画面表示の対応。キーは memberStatus ルーターの enum と一致させる。
const statusDetails = {
  unknown: { label: "未確認", className: "bg-neutral-soft text-ink" },
  safe_home: { label: "自宅で無事", className: "bg-passable text-white" },
  preparing: {
    label: "避難の準備中",
    className: "bg-caution text-caution-contrast",
  },
  evacuating: {
    label: "避難中",
    className: "bg-caution text-caution-contrast",
  },
  at_shelter: { label: "避難済み", className: "bg-passable text-white" },
  needs_help: { label: "支援が必要", className: "bg-impassable text-white" },
  safe_other: { label: "別の場所で無事", className: "bg-passable text-white" },
} as const;

type MemberStatus = keyof typeof statusDetails;

// 画面から選べる状態。`unknown` は「まだ登録がない」ことを表す値なので選ばせない。
const selectableStatuses = [
  "safe_home",
  "preparing",
  "evacuating",
  "at_shelter",
  "needs_help",
  "safe_other",
] as const satisfies ReadonlyArray<MemberStatus>;

// 世帯の家族一覧と、その安否を更新する操作をまとめて表示する。
export function FamilyStatusBoard() {
  const memberList = api.memberStatus.listForHousehold.useQuery();
  const apiUtils = api.useUtils();
  const setStatus = api.memberStatus.set.useMutation();
  // 状態を選ぶ欄は一度にひとりぶんだけ開く。
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const submitStatus = async (
    memberId: string,
    status: MemberStatus,
    needsHelp: boolean,
  ) => {
    setUpdateError(null);

    try {
      await setStatus.mutateAsync({ memberId, status, needsHelp });
      await apiUtils.memberStatus.listForHousehold.invalidate();
      setOpenMemberId(null);
    } catch (error) {
      setUpdateError(getUpdateErrorMessage(error));
    }
  };

  if (memberList.isPending) {
    return (
      <output className="block py-6 text-center text-sm font-bold text-muted">
        家族の安否を読み込んでいます
      </output>
    );
  }

  if (memberList.isError) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-impassable-soft px-4 py-3 text-sm font-bold text-impassable"
      >
        {getListErrorMessage(memberList.error)}
      </p>
    );
  }

  const members = memberList.data;

  if (members.length === 0) {
    return (
      <p className="rounded-lg bg-neutral-soft px-4 py-3 text-sm font-bold text-muted">
        家族がまだ登録されていません。設定から家族を登録してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {updateError ? (
        <p
          role="alert"
          className="rounded-lg bg-impassable-soft px-4 py-3 text-sm font-bold text-impassable"
        >
          {updateError}
        </p>
      ) : null}

      <ul aria-label="家族の避難状況" className="space-y-6">
        {members.map((member) => {
          const status = statusDetails[toMemberStatus(member.status)];
          // 代理で登録できるのはアカウントを持たない家族だけ（DB 側の判定と揃える）。
          const canUpdate = member.isSelf || !member.hasAccount;
          const isOpen = openMemberId === member.memberId;
          const panelId = `family-status-options-${member.memberId}`;

          return (
            <li key={member.memberId} className="space-y-2">
              <div className="flex min-h-14 items-center justify-between gap-4">
                <span className="text-family-label leading-tight font-normal text-muted">
                  {member.displayName}
                  {member.isSelf ? (
                    <span className="ml-1 text-sm font-bold">（自分）</span>
                  ) : null}
                </span>

                {canUpdate ? (
                  <button
                    type="button"
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    aria-label={`${member.displayName}の安否は${status.label}。変更する`}
                    onClick={() =>
                      setOpenMemberId(isOpen ? null : member.memberId)
                    }
                    className={`text-family-label flex min-h-14 w-[min(15rem,58vw)] items-center justify-center rounded-full px-5 text-center leading-tight font-bold outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand ${status.className}`}
                  >
                    {status.label}
                  </button>
                ) : (
                  <span
                    className={`text-family-label flex min-h-14 w-[min(15rem,58vw)] items-center justify-center rounded-full px-5 text-center leading-tight font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                )}
              </div>

              {member.needsHelp ? (
                <p className="text-sm font-bold text-impassable">
                  支援が必要です
                </p>
              ) : null}
              {member.message ? (
                <p className="text-sm text-muted">{member.message}</p>
              ) : null}
              {member.statusUpdatedAt ? (
                <p className="text-xs font-bold text-muted">
                  {formatUpdatedAt(member.statusUpdatedAt)}更新
                </p>
              ) : null}

              {canUpdate ? (
                <div id={panelId} hidden={!isOpen} className="space-y-2 pt-1">
                  <ul
                    aria-label={`${member.displayName}の安否を選ぶ`}
                    className="grid grid-cols-2 gap-2"
                  >
                    {selectableStatuses.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            submitStatus(
                              member.memberId,
                              option,
                              option === "needs_help",
                            )
                          }
                          className="min-h-11 w-full rounded-lg border border-outline bg-surface px-3 text-sm font-bold text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-muted"
                        >
                          {statusDetails[option].label}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* 状態とは別に立てる。避難済みでも支援が要ることがあるため。 */}
                  <button
                    type="button"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      submitStatus(
                        member.memberId,
                        toMemberStatus(member.status),
                        !member.needsHelp,
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-brand bg-surface px-3 text-sm font-bold text-brand outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:border-outline disabled:text-muted"
                  >
                    {member.needsHelp
                      ? "支援は足りていると伝える"
                      : "支援が必要と伝える"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 表示できない状態が返ってきても画面を壊さないよう「未確認」へ寄せる。
function toMemberStatus(status: string | null): MemberStatus {
  return status !== null && status in statusDetails
    ? (status as MemberStatus)
    : "unknown";
}

function getErrorCode(error: unknown) {
  if (
    error !== null &&
    typeof error === "object" &&
    "data" in error &&
    error.data !== null &&
    typeof error.data === "object" &&
    "code" in error.data &&
    typeof error.data.code === "string"
  ) {
    return error.data.code;
  }
  return null;
}

function getListErrorMessage(error: unknown) {
  const code = getErrorCode(error);
  if (code === "UNAUTHORIZED") {
    return "家族の安否を見るにはログインが必要です。";
  }
  if (code === "NOT_FOUND") {
    return "世帯がまだ登録されていません。設定から家族を登録してください。";
  }
  return "家族の安否を取得できませんでした。時間をおいてもう一度お試しください。";
}

function getUpdateErrorMessage(error: unknown) {
  const code = getErrorCode(error);
  if (code === "UNAUTHORIZED") {
    return "安否の登録にはログインが必要です。";
  }
  if (code === "FORBIDDEN") {
    return "この家族の安否は本人だけが登録できます。";
  }
  return "安否を登録できませんでした。時間をおいてもう一度お試しください。";
}

// 安否を最後に更新した時刻を日本時間で表示する。
function formatUpdatedAt(updatedAt: string) {
  const updatedAtDate = new Date(updatedAt);
  if (Number.isNaN(updatedAtDate.getTime())) return "--:--";

  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(updatedAtDate);
}
