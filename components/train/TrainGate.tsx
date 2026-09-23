/**
 * 교육 입구 화면들 — 로그인 전 / 과정 없음 / TalentCore 연결 안 됨.
 * 서버에서 그린다(열쇠·주소를 브라우저로 보내지 않는다).
 */

const WHY: Record<string, string> = {
  again: "로그인 요청이 만료됐습니다. 다시 눌러 주세요.",
  fail: "TalentCore 가 로그인을 확인해 주지 않았습니다. 다시 눌러 주세요.",
  off: "이 Grow 는 TalentCore 와 연결돼 있지 않습니다. 관리자에게 문의하세요.",
  gone: "TalentCore 에서 이 계정을 쓸 수 없습니다(퇴사·정지). 다른 계정으로 로그인하세요.",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-4">
      <div className="rounded border border-line bg-surface p-5">
        <div className="text-[11px] font-bold text-muted">Grow · 직무 교육</div>
        {children}
      </div>
    </div>
  );
}

function Logout({ label = "다른 계정으로 로그인" }: { label?: string }) {
  return (
    <form action="/api/auth/logout" method="post" className="mt-2">
      <button
        type="submit"
        className="w-full rounded border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:bg-sunken"
      >
        {label}
      </button>
    </form>
  );
}

export function TrainLogin({ why }: { why?: string }) {
  return (
    <Frame>
      <h1 className="mt-1 text-[16px] font-bold text-ink">TalentCore 계정으로 로그인</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        회사 계정 그대로 들어옵니다. 세부 직무에 맞는 과정이 열리고, 수료 기록은 TalentCore 프로필에 남습니다.
      </p>
      {why && WHY[why] ? (
        <p className="mt-3 rounded border border-warning-border bg-warning-soft px-3 py-2 text-[12px] text-warning-text">
          {WHY[why]}
        </p>
      ) : null}
      <a
        href="/api/auth/core/start"
        className="mt-4 block rounded bg-primary px-3 py-2.5 text-center text-[13px] font-bold text-white hover:bg-primary-hover"
      >
        TalentCore 로 로그인
      </a>
      {why === "gone" ? <Logout /> : null}
    </Frame>
  );
}

export function TrainNoCourse({
  name,
  dept,
  profile,
}: {
  name: string;
  dept: string;
  profile?: string | null;
}) {
  return (
    <Frame>
      <h1 className="mt-1 text-[16px] font-bold text-ink">배정된 과정 없음</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        {name}
        {dept ? ` · ${dept}` : ""}
        <br />
        {profile ? `세부 직무 '${profile}' 과정은 아직 준비 중입니다.` : "TalentCore 에 세부 직무가 비어 있습니다."}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        인사 담당자가 TalentCore 직원 정보에서 세부 직무(리크루팅 코디네이터 · 리크루터)를 지정하면 과정이 열립니다.
      </p>
      <Logout />
    </Frame>
  );
}

export function TrainOffline() {
  return (
    <Frame>
      <h1 className="mt-1 text-[16px] font-bold text-ink">TalentCore 에 연결하지 못했습니다</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        잠시 뒤 새로고침해 주세요. 계속되면 관리자에게 문의하세요.
      </p>
      <Logout label="로그아웃" />
    </Frame>
  );
}
