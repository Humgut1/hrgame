"use client";

import { useEffect } from "react";

import { useSession } from "@/lib/game/SessionProvider";

/** 문서 상세 페이지에 마운트되면 열람 기록을 남긴다. 렌더링하는 건 없다. */
export function MarkDocRead({ docId }: { docId: string }) {
  const { dispatch, hydrating } = useSession();

  useEffect(() => {
    // 복원 전에 기록하면 SessionProvider의 localStorage 복원(자식 이펙트보다 늦게 실행됨)이
    // 이 기록을 덮어써 버린다. 복원이 끝난 뒤에만 기록한다.
    if (hydrating) return;
    dispatch({ type: "doc_read", docId });
  }, [docId, dispatch, hydrating]);

  return null;
}
