"use client";

import { useState } from "react";
import {
  GripVertical,
  Copy,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Question,
  QuestionType,
  QUESTION_TYPE_LABELS,
} from "@/lib/interfaces/form-builder";

interface QuestionCardProps {
  question: Question;
  index: number;
  onUpdate: (updates: Partial<Question>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function QuestionCard({
  question,
  index,
  onUpdate,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isChoiceType =
    question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE";

  function handleAddOption() {
    const newOptions = [...(question.options || []), ""];
    onUpdate({ options: newOptions });
  }

  function handleUpdateOption(optionIndex: number, value: string) {
    const newOptions = [...(question.options || [])];
    newOptions[optionIndex] = value;
    onUpdate({ options: newOptions });
  }

  function handleDeleteOption(optionIndex: number) {
    const newOptions = (question.options || []).filter(
      (_, idx) => idx !== optionIndex,
    );
    onUpdate({ options: newOptions });
  }

  return (
    <Card className="relative min-w-0 max-w-full transition-shadow hover:shadow-md">
      <CardContent className="min-w-0 pt-3 pb-3">
        {/* Collapsed Header */}
        <div className="flex items-center gap-2">
          <div className="cursor-move text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="-mx-2 -my-1 flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
          >
            <Badge variant="secondary" className="shrink-0 text-xs py-0">
              {index + 1}
            </Badge>
            <span className="font-semibold flex-1 min-w-0 line-clamp-2 text-sm">
              {question.title || "(제목 없음)"}
            </span>
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] py-0 px-1.5"
            >
              {QUESTION_TYPE_LABELS[question.type]}
            </Badge>
            {question.required && (
              <Badge
                variant="destructive"
                className="shrink-0 text-[10px] py-0 px-1.5"
              >
                필수
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </button>

          <div className="flex flex-col gap-0.5 self-stretch h-full">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="위로 이동"
              className="shrink-0 h-full w-7 rounded-b-none"
            >
              <ChevronUp className="h-3 w-3 fill" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="아래로 이동"
              className="shrink-0 h-full w-7 rounded-t-none"
            >
              <ChevronDown className="h-3 w-3 fill" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                복제
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-4">
            {/* Question Identity */}
            <div className="space-y-1.5">
              <Label
                htmlFor={`question-title-${question.id}`}
                className="text-sm font-medium"
              >
                질문 제목
              </Label>
              <Textarea
                id={`question-title-${question.id}`}
                placeholder="질문을 입력하세요"
                value={question.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setIsExpanded(false);
                  }
                }}
                rows={2}
                className="resize-none focus-visible:ring-2"
              />
            </div>

            {/* Answer Configuration */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor={`question-type-${question.id}`}
                  className="text-sm"
                >
                  답변 형식
                </Label>
                <Select
                  value={question.type}
                  onValueChange={(value: QuestionType) =>
                    onUpdate({ type: value })
                  }
                >
                  <SelectTrigger
                    id={`question-type-${question.id}`}
                    className="focus:ring-2 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_TEXT">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">짧은 답변</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="LONG_TEXT">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">긴 답변</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="SINGLE_CHOICE">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">하나 선택</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="MULTIPLE_CHOICE">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">
                          여러 개 선택
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options for choice types */}
              {isChoiceType && (
                <div className="bg-muted/20 rounded-md p-3 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    선택지 구성
                  </Label>
                  <div className="space-y-1.5">
                    {(question.options || []).map((option, idx) => (
                      <div key={idx} className="flex min-w-0 gap-1.5">
                        <Input
                          placeholder={`선택지 ${idx + 1}`}
                          value={option}
                          onChange={(e) =>
                            handleUpdateOption(idx, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddOption();
                            }
                          }}
                          className="h-9 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOption(idx)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                      className="w-full h-8 text-xs mt-1"
                    >
                      선택지 추가
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id={`question-required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => onUpdate({ required: checked })}
                />
                <Label
                  htmlFor={`question-required-${question.id}`}
                  className="cursor-pointer text-sm"
                >
                  필수 질문
                </Label>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
