"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { FormSchema } from "@/lib/interfaces/form-builder";

interface FormPreviewProps {
  schema: FormSchema;
}

export function FormPreview({ schema }: FormPreviewProps) {
  if (schema.questions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <p>질문이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-hidden">
      {schema.questions.map((question, index) => (
        <Card key={question.id} className="min-w-0 max-w-full overflow-hidden">
          <CardContent className="min-w-0 max-w-full overflow-hidden space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm font-medium">
                  {index + 1}. {question.title || "(제목 없음)"}
                </span>
                {question.required && (
                  <Badge variant="destructive" className="text-xs shrink-0">
                    필수
                  </Badge>
                )}
              </div>

              {/* Render input based on question type */}
              {question.type === "SHORT_TEXT" && (
                <Input placeholder="답변을 입력하세요" disabled />
              )}

              {question.type === "LONG_TEXT" && (
                <Textarea
                  placeholder="답변을 입력하세요"
                  className="min-h-32 resize-none"
                  disabled
                />
              )}

              {question.type === "SINGLE_CHOICE" && (
                <RadioGroup disabled>
                  {(question.options || []).map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={`${idx}`}
                        id={`${question.id}-${idx}`}
                      />
                      <Label
                        htmlFor={`${question.id}-${idx}`}
                        className="min-w-0 flex-1 [overflow-wrap:anywhere] font-normal"
                      >
                        {option || `(선택지 ${idx + 1})`}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.type === "MULTIPLE_CHOICE" && (
                <div className="space-y-2">
                  {(question.options || []).map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox id={`${question.id}-${idx}`} disabled />
                      <Label
                        htmlFor={`${question.id}-${idx}`}
                        className="min-w-0 flex-1 [overflow-wrap:anywhere] font-normal"
                      >
                        {option || `(선택지 ${idx + 1})`}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
