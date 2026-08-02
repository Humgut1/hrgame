"use client";

/**
 * 세션 상태를 들고 있는 클라이언트 컨텍스트.
 *
 * 여기에 들어오는 시나리오는 반드시 ClientScenario(= toClientScenario 통과분)여야 한다.
 * 전체 Scenario를 넘기면 secrets가 브라우저로 새어 나간다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deriveClock, type ClockState } from "@/lib/clock";
import type {
  GradeReport,
  GradeRequest,
  NpcTurnRequest,
  NpcTurnResponse,
} from "@/lib/game/api";
import type { OfferValues } from "@/lib/game/offer";
import {
  canSendMessage,
  canSubmitOffer,
  initialSession,
  isCompatible,
  reduceSession,
  sendBlockedReason,
  submitBlockedReason,
  type SessionAction,
  type SessionState,
} from "@/lib/game/state";
import { clearSession, loadSession, saveSession } from "@/lib/game/storage";
import type { ClientScenario } from "@/types/scenario";

interface SessionContextValue {
  scenario: ClientScenario;
  state: SessionState;
  clock: ClockState;
  /** 서버 왕복 없이 끝나는 전환들 */
  dispatch: (action: SessionAction) => void;
  /** 메시지 전송. 턴 소모 → /api/npc → 답장 반영까지. */
  sendMessage: (npcId: string, text: string) => Promise<void>;
  canSend: boolean;
  blockedReason?: string;
  /** 오퍼 발송 → /api/grade → 리포트 반영까지. 되돌릴 수 없다. */
  submitOffer: (offer: OfferValues) => Promise<void>;
  /** 채점만 다시 부른다. 오퍼는 이미 나갔으므로 재전송하지 않는다. */
  retryGrade: () => Promise<void>;
  canSubmit: boolean;
  submitReason?: string;
  restart: () => void;
  /** 저장된 판을 복원하기 전에는 true. 서버 렌더와 어긋나는 걸 막는다. */
  hydrating: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  scenario,
  children,
}: {
  scenario: ClientScenario;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<SessionState>(() => initialSession(scenario));
  const [hydrating, setHydrating] = useState(true);

  // 서버 렌더 결과와 첫 클라이언트 렌더가 같아야 하므로, 복원은 마운트 이후에 한 번만 한다.
  useEffect(() => {
    const saved = loadSession(scenario.id);
    if (saved && isCompatible(saved, scenario)) {
      // 답장이나 채점을 기다리던 중 새로고침했다면 그 요청은 이미 사라졌다.
      setState({
        ...saved,
        grading: false,
        npcs: Object.fromEntries(
          Object.entries(saved.npcs).map(([id, n]) => [id, { ...n, pending: false }])
        ),
      });
    }
    setHydrating(false);
  }, [scenario]);

  useEffect(() => {
    if (!hydrating) saveSession(state);
  }, [state, hydrating]);

  const dispatch = useCallback(
    (action: SessionAction) => setState((prev) => reduceSession(prev, action, scenario)),
    [scenario]
  );

  // 리듀서 결과를 비동기 흐름 안에서도 읽어야 해서 최신 상태를 따로 잡아 둔다.
  const stateRef = useRef(state);
  stateRef.current = state;

  const sendMessage = useCallback(
    async (npcId: string, text: string) => {
      const before = stateRef.current;
      if (!canSendMessage(before, scenario)) return;

      const messageId = `${npcId}-${before.turnsUsed}-${Math.random().toString(36).slice(2, 8)}`;

      const body: NpcTurnRequest = {
        scenarioId: scenario.id,
        npcId,
        trust: before.npcs[npcId].trust,
        turnsUsed: before.turnsUsed,
        revealedSecretIds: before.npcs[npcId].revealedSecretIds,
        history: before.npcs[npcId].messages
          .filter((m) => !m.failed)
          .map((m) => ({ from: m.from, text: m.text })),
        message: text,
      };

      setState((prev) => reduceSession(prev, { type: "send", npcId, text, messageId }, scenario));

      try {
        const res = await fetch("/api/npc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error ?? `요청 실패 (${res.status})`);
        }

        const data = (await res.json()) as NpcTurnResponse;
        setState((prev) =>
          reduceSession(
            prev,
            {
              type: "reply",
              npcId,
              messageId,
              text: data.reply,
              trust: data.trust,
              revealedSecretIds: data.revealedSecretIds,
            },
            scenario
          )
        );
      } catch (e) {
        setState((prev) =>
          reduceSession(
            prev,
            {
              type: "send_failed",
              npcId,
              messageId,
              error: e instanceof Error ? e.message : "답장을 받지 못했습니다.",
            },
            scenario
          )
        );
      }
    },
    [scenario]
  );

  /** 채점 요청 본문은 판 전체다 — 무엇을 읽었고 누구와 무슨 말을 했는지가 채점 근거다. */
  const runGrade = useCallback(
    async (offer: OfferValues) => {
      const snapshot = stateRef.current;
      const body: GradeRequest = {
        scenarioId: scenario.id,
        offer,
        turnsUsed: snapshot.turnsUsed,
        readDocIds: snapshot.readDocIds,
        npcs: Object.entries(snapshot.npcs).map(([npcId, n]) => ({
          npcId,
          trust: n.trust,
          messages: n.messages
            .filter((m) => !m.failed)
            .map((m) => ({ from: m.from, text: m.text })),
        })),
      };

      try {
        const res = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error ?? `채점 실패 (${res.status})`);
        }

        const report = (await res.json()) as GradeReport;
        setState((prev) => reduceSession(prev, { type: "graded", report }, scenario));
      } catch (e) {
        setState((prev) =>
          reduceSession(
            prev,
            {
              type: "grade_failed",
              error: e instanceof Error ? e.message : "채점 결과를 받지 못했습니다.",
            },
            scenario
          )
        );
      }
    },
    [scenario]
  );

  const submitOffer = useCallback(
    async (offer: OfferValues) => {
      if (!canSubmitOffer(stateRef.current)) return;
      setState((prev) => reduceSession(prev, { type: "submit_offer", offer }, scenario));
      await runGrade(offer);
    },
    [scenario, runGrade]
  );

  const retryGrade = useCallback(async () => {
    const { offer, grading } = stateRef.current;
    if (!offer || grading) return;
    setState((prev) => reduceSession(prev, { type: "grading" }, scenario));
    await runGrade(offer);
  }, [scenario, runGrade]);

  const restart = useCallback(() => {
    clearSession(scenario.id);
    setState(initialSession(scenario));
  }, [scenario]);

  const value = useMemo<SessionContextValue>(
    () => ({
      scenario,
      state,
      clock: deriveClock(scenario.clock, state.turnsUsed),
      dispatch,
      sendMessage,
      canSend: canSendMessage(state, scenario),
      blockedReason: sendBlockedReason(state, scenario),
      submitOffer,
      retryGrade,
      canSubmit: canSubmitOffer(state),
      submitReason: submitBlockedReason(state),
      restart,
      hydrating,
    }),
    [
      scenario,
      state,
      dispatch,
      sendMessage,
      submitOffer,
      retryGrade,
      restart,
      hydrating,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession은 SessionProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}

export function useNpcSession(npcId: string) {
  const { state } = useSession();
  return state.npcs[npcId];
}
