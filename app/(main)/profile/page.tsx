"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getMe, updateMe, changePassword } from "@/lib/api/auth";
import { UserInfoResponseDto } from "@/lib/interfaces/auth";
import {
  Pencil,
  Lock,
  Mail,
  Phone,
  BookOpen,
  GitBranch,
  ChevronLeft,
  CalendarDays,
  Github,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";

// Validation schemas
const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  username: z.string().min(1, "사용자명을 입력해주세요"),
  studentId: z.string().min(1, "학번을 입력해주세요"),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  phoneNumber: z.string().min(1, "전화번호를 입력해주세요"),
  githubId: z.string().min(1, "GitHub ID를 입력해주세요"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
  newPassword: z
    .string()
    .min(8, "새 비밀번호는 최소 8자 이상이어야 합니다")
    .max(100, "새 비밀번호는 100자 이하로 입력해주세요"),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type Mode = "view" | "edit" | "password";

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 border-b py-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { hasRole } = useAuth();
  const canEditIdentity = hasRole("ADMIN");
  const [mode, setMode] = useState<Mode>("view");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<UserInfoResponseDto | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const userData = await getMe();
        setProfile(userData);
        resetProfile({
          name: userData.name,
          username: userData.username,
          studentId: userData.studentId,
          email: userData.email,
          phoneNumber: userData.phoneNumber || "",
          githubId: userData.githubId || "",
        });
      } catch (error: any) {
        toast.error(error.response?.data || "프로필을 불러오는데 실패했습니다");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [resetProfile]);

  const onSubmitProfile = async (data: ProfileFormData) => {
    try {
      setIsSaving(true);
      await updateMe(data);
      setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      toast.success("프로필이 성공적으로 업데이트되었습니다");
      setMode("view");
    } catch (error: any) {
      toast.error(error.response?.data || "프로필 업데이트에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmitPassword = async (data: PasswordFormData) => {
    try {
      setIsSaving(true);
      await changePassword(data);
      toast.success("비밀번호가 성공적으로 변경되었습니다");
      resetPassword();
      setMode("view");
    } catch (error: any) {
      toast.error(error.response?.data || "비밀번호 변경에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = () => {
    if (profile) {
      resetProfile({
        name: profile.name,
        username: profile.username,
        studentId: profile.studentId,
        email: profile.email,
        phoneNumber: profile.phoneNumber || "",
        githubId: profile.githubId || "",
      });
    }
    setMode("edit");
  };

  const handleCancelEdit = () => {
    setMode("view");
  };

  const handleCancelPassword = () => {
    resetPassword();
    setMode("view");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-40 mt-3" />
            <Skeleton className="h-4 w-24 mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-start gap-4 border-b border-[var(--m3-outline)] pb-6">
        {mode !== "view" && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={mode === "edit" ? handleCancelEdit : handleCancelPassword}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "view" && "내 프로필"}
            {mode === "edit" && "정보 수정"}
            {mode === "password" && "비밀번호 변경"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {mode === "view" && "내 계정 정보를 확인합니다"}
            {mode === "edit" && "변경할 정보를 입력하세요"}
            {mode === "password" && "새로운 비밀번호를 설정합니다"}
          </p>
        </div>
      </div>

      {/* View Mode */}
      {mode === "view" && profile && (
        <Card>
          <CardContent className="pt-6">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-semibold text-primary">
                  {profile.name?.charAt(0) || "?"}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold">{profile.name}</p>
                <p className="text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
            </div>

            <Separator />

            {/* Info rows */}
            <div className="grid gap-x-10 sm:grid-cols-2">
              <InfoRow
                icon={<BookOpen className="h-4 w-4" />}
                label="학번"
                value={profile.studentId}
              />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="이메일"
                value={profile.email}
              />
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="전화번호"
                value={profile.phoneNumber}
              />
              <InfoRow
                icon={<Github className="h-4 w-4" />}
                label="GitHub ID"
                value={profile.githubId}
              />
              <InfoRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="가입 분기"
                value={profile.joinedQuarter?.name}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              <Button
                variant="outline"
                onClick={handleEditClick}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                정보 수정
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMode("password")}
                className="gap-2 text-muted-foreground"
              >
                <Lock className="h-4 w-4" />
                비밀번호 변경
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Mode */}
      {mode === "edit" && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitProfile(onSubmitProfile)}>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    {...registerProfile("name")}
                    disabled={isSaving}
                    readOnly={!canEditIdentity}
                    placeholder="이름을 입력하세요"
                    className={!canEditIdentity ? "bg-muted" : undefined}
                  />
                  {profileErrors.name && (
                    <p className="text-xs text-destructive">
                      {profileErrors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="username">사용자명</Label>
                  <Input
                    id="username"
                    {...registerProfile("username")}
                    disabled={isSaving}
                    placeholder="사용자명을 입력하세요"
                  />
                  {profileErrors.username && (
                    <p className="text-xs text-destructive">
                      {profileErrors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="studentId">학번</Label>
                  <Input
                    id="studentId"
                    {...registerProfile("studentId")}
                    disabled={isSaving}
                    readOnly={!canEditIdentity}
                    placeholder="학번을 입력하세요"
                    className={!canEditIdentity ? "bg-muted" : undefined}
                  />
                  {profileErrors.studentId && (
                    <p className="text-xs text-destructive">
                      {profileErrors.studentId.message}
                    </p>
                  )}
                  {!canEditIdentity && (
                    <p className="text-xs text-muted-foreground">
                      이름과 학번 변경은 관리자에게 요청해주세요.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    {...registerProfile("email")}
                    disabled={isSaving}
                    placeholder="이메일을 입력하세요"
                  />
                  {profileErrors.email && (
                    <p className="text-xs text-destructive">
                      {profileErrors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber">전화번호</Label>
                  <Input
                    id="phoneNumber"
                    {...registerProfile("phoneNumber")}
                    disabled={isSaving}
                    placeholder="전화번호를 입력하세요"
                  />
                  {profileErrors.phoneNumber && (
                    <p className="text-xs text-destructive">
                      {profileErrors.phoneNumber.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="githubId">GitHub ID</Label>
                  <Input
                    id="githubId"
                    {...registerProfile("githubId")}
                    disabled={isSaving}
                    placeholder="GitHub ID를 입력하세요"
                  />
                  {profileErrors.githubId && (
                    <p className="text-xs text-destructive">
                      {profileErrors.githubId.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2 sm:col-span-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "저장 중..." : "저장"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Password Change Mode */}
      {mode === "password" && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitPassword(onSubmitPassword)}>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">현재 비밀번호</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...registerPassword("currentPassword")}
                    disabled={isSaving}
                    placeholder="현재 비밀번호를 입력하세요"
                  />
                  {passwordErrors.currentPassword && (
                    <p className="text-xs text-destructive">
                      {passwordErrors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...registerPassword("newPassword")}
                    disabled={isSaving}
                    placeholder="새 비밀번호를 입력하세요 (최소 8자)"
                  />
                  {passwordErrors.newPassword && (
                    <p className="text-xs text-destructive">
                      {passwordErrors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2 sm:col-span-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "변경 중..." : "변경"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPassword}
                    disabled={isSaving}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
