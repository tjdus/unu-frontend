"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signup, verifySignupEligibility } from "@/lib/api/auth";
import { SignUpRequestDto, SignupEligibility } from "@/lib/interfaces/auth";
import { AccountPage } from "@/components/custom/account-page";
import { PRIVACY_POLICY_PATH, SIGNUP_PRIVACY_NOTICE } from "@/lib/privacy-policy";
import styles from "@/components/custom/account-page.module.css";

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function SignupForm({ token }: { token: string | null }) {
  const [studentId, setStudentId] = useState("");
  const [eligibility, setEligibility] = useState<SignupEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [complete, setComplete] = useState(false);

  if (complete || !token || invalid) {
    return (
      <AccountPage
        title={complete ? "가입 완료" : "회원가입"}
        intro={complete ? "CNU에 오신 것을 환영합니다!" : "운영진에게 받은 초대 링크로 접속해 주세요."}
      >
        <div className={styles.message}>
          <span className={styles.eyebrow}>{complete ? "SIGN UP COMPLETE" : "INVITATION REQUIRED"}</span>
          <h2>{complete ? "가입이 완료되었습니다" : "초대 링크를 사용할 수 없습니다"}</h2>
          <p>{complete ? "가입한 아이디와 비밀번호로 로그인할 수 있습니다." : "링크가 만료되었거나 유효하지 않습니다. 운영진에게 새 초대 링크를 요청해 주세요."}</p>
          <div className={styles.actions}>
            <Link href={complete ? "/login" : "/"} className={styles.primary}>
              {complete ? "로그인하기" : "홈으로 돌아가기"} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </AccountPage>
    );
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setEligibility(await verifySignupEligibility(token!, studentId));
    } catch (verifyError) {
      if (verifyError instanceof Error && /만료된 회원가입 링크/.test(verifyError.message)) {
        setInvalid(true);
        return;
      }
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "가입 대상을 확인하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligibility) return;
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const passwordConfirm = formData.get("passwordConfirm") as string;
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data: SignUpRequestDto = {
        name: formData.get("name") as string,
        username: formData.get("username") as string,
        password,
        studentId: eligibility.studentId,
        major: formData.get("major") as string,
        subMajor: formData.get("subMajor") as string,
        email: formData.get("email") as string,
        phoneNumber: formData.get("phoneNumber") as string,
        githubId: formData.get("githubId") as string,
      };
      await signup(data, token!);
      setComplete(true);
    } catch (submitError) {
      if (submitError instanceof Error && /만료된 회원가입 링크/.test(submitError.message)) {
        setInvalid(true);
        return;
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : "회원가입 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountPage title="회원가입" intro={eligibility ? "사용할 계정 정보를 입력해 주세요." : "초대받은 학번을 확인하고 CNU 계정을 만들어 보세요."}>
          <div className={styles.steps} aria-label="가입 단계">
            <span aria-current={!eligibility ? "step" : undefined}>01 가입 대상 확인</span>
            <span aria-current={eligibility ? "step" : undefined}>02 계정 정보</span>
          </div>
          {!eligibility ? (
            <form onSubmit={handleVerify} className={styles.form}>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="studentId">학번</FieldLabel>
                  <Input
                    id="studentId"
                    type="text"
                    value={studentId}
                    onChange={(event) =>
                      setStudentId(event.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="학번 8자리를 입력하세요"
                    className="h-11"
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    autoFocus
                    required
                  />
                </Field>
                {error && (
                  <div role="alert" className={styles.error}>
                    {error}
                  </div>
                )}
                <div className={styles.actions}>
                  <Button type="submit" className={styles.primary} disabled={loading}>
                    {loading ? "확인 중..." : "가입 대상 확인"}
                  </Button>
                </div>
                <FieldDescription className={styles.hint}>
                  명단에 등록된 학번만 가입할 수 있습니다.
                </FieldDescription>
              </FieldGroup>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <FieldGroup className={styles.fields}>
                <div className={styles.notice}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#8fe3b0]" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">가입 대상 확인 완료</p>
                      <p className="mt-1 text-sm">
                        {eligibility.studentId} · {eligibility.joinedQuarterName}
                      </p>
                      <p className="mt-1 text-xs">
                        {eligibility.invitationName}
                      </p>
                    </div>
                  </div>
                </div>
                <Field>
                  <FieldLabel htmlFor="name">이름</FieldLabel>
                  <Input id="name" name="name" type="text" defaultValue={eligibility.name ?? ""} placeholder="이름을 입력하세요" className="h-11" maxLength={50} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="major">전공</FieldLabel>
                  <Input id="major" name="major" type="text" defaultValue={eligibility.major ?? ""} placeholder="전공을 입력하세요" className="h-11" maxLength={100} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="subMajor">부전공 (선택)</FieldLabel>
                  <Input id="subMajor" name="subMajor" type="text" defaultValue={eligibility.subMajor ?? ""} placeholder="부전공이 있다면 입력하세요 (선택)" className="h-11" maxLength={100} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">아이디</FieldLabel>
                  <Input id="username" name="username" type="text" placeholder="아이디를 입력하세요" className="h-11" maxLength={50} pattern={String.raw`[A-Za-z0-9._\-]+`} title="영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다." autoComplete="username" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">비밀번호</FieldLabel>
                  <Input id="password" name="password" type="password" placeholder="8자 이상 입력하세요" aria-describedby="signup-password-hint" className="h-11" minLength={8} maxLength={100} autoComplete="new-password" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="passwordConfirm">비밀번호 확인</FieldLabel>
                  <Input id="passwordConfirm" name="passwordConfirm" type="password" placeholder="비밀번호를 다시 입력해 주세요" className="h-11" minLength={8} maxLength={100} autoComplete="new-password" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">이메일</FieldLabel>
                  <Input id="email" name="email" type="email" defaultValue={eligibility.email ?? ""} placeholder="이메일을 입력하세요" className="h-11" maxLength={255} autoComplete="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phoneNumber">전화번호</FieldLabel>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    defaultValue={eligibility.phoneNumber ?? ""}
                    placeholder="010-0000-0000"
                    className="h-11"
                    inputMode="numeric"
                    maxLength={13}
                    pattern="010-[0-9]{4}-[0-9]{4}"
                    title="전화번호는 010-0000-0000 형식으로 입력해주세요."
                    autoComplete="tel"
                    onInput={(event) => {
                      event.currentTarget.value = formatPhoneNumber(event.currentTarget.value);
                    }}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="githubId">GitHub ID (선택)</FieldLabel>
                  <Input id="githubId" name="githubId" type="text" defaultValue={eligibility.githubId ?? ""} placeholder="GitHub 아이디를 입력하세요 (선택)" className="h-11" maxLength={100} autoComplete="off" />
                </Field>
                <div className={styles.privacyNotice}>
                  <p>{SIGNUP_PRIVACY_NOTICE.required}</p>
                  <p>{SIGNUP_PRIVACY_NOTICE.optional}</p>
                  <p>
                    자세한 내용은{" "}
                    <Link href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener" className={styles.policyLink}>
                      개인정보 처리방침
                    </Link>
                    에서 확인하실 수 있습니다.
                  </p>
                </div>
                {error && (
                  <div role="alert" className={styles.error}>
                    {error}
                  </div>
                )}
                <p id="signup-password-hint" className={styles.hint}>다른 서비스에서 자주 사용하지 않는 비밀번호를 사용해 주세요.</p>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="outline"
                    className={styles.secondary}
                    onClick={() => {
                      setEligibility(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    뒤로가기
                  </Button>
                  <Button type="submit" className={styles.primary} disabled={loading}>
                    {loading ? "처리 중..." : "회원가입"}
                  </Button>
                </div>
                <FieldDescription className={styles.hint}>
                  계정 관련 문의는 운영진에게 연락해주세요.
                </FieldDescription>
              </FieldGroup>
            </form>
          )}
    </AccountPage>
  );
}

function SignupContent() {
  const token = useSearchParams().get("token");
  return <SignupForm key={token} token={token} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AccountPage title="회원가입" intro="초대받은 학번을 확인하고 CNU 계정을 만들어 보세요." />}>
      <SignupContent />
    </Suspense>
  );
}
