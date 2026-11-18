"use client";

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, Clock3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  clearable?: boolean;
  className?: string;
  includeTime?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function parseValue(value?: string) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value, onChange, placeholder, id, disabled = false, min, max,
  clearable = false, className, includeTime = false, ...ariaProps
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState<Date>();
  const [hour, setHour] = React.useState("00");
  const [minute, setMinute] = React.useState("00");
  const [month, setMonth] = React.useState(new Date());
  const date = parseValue(value);
  const minDate = parseValue(min?.slice(0, 10));
  const maxDate = parseValue(max?.slice(0, 10));
  const timeValid = /^\d{1,2}$/.test(hour) && Number(hour) < 24 &&
    /^\d{1,2}$/.test(minute) && Number(minute) < 60;
  const draft = draftDate && timeValid
    ? format(draftDate, "yyyy-MM-dd") + "T" + hour.padStart(2, "0") + ":" + minute.padStart(2, "0")
    : "";
  const inBounds = Boolean(draft) &&
    (!min || draft >= min.slice(0, 16)) &&
    (!max || draft <= (max.length === 10 ? max + "T23:59" : max.slice(0, 16)));
  const timeId = React.useId();

  function changeOpen(next: boolean) {
    if (next) {
      setDraftDate(date);
      setHour(date ? format(date, "HH") : "00");
      setMinute(date ? format(date, "mm") : "00");
      let initialMonth = date ?? new Date();
      if (minDate && initialMonth < minDate) initialMonth = minDate;
      if (maxDate && initialMonth > maxDate) initialMonth = maxDate;
      setMonth(initialMonth);
    }
    setOpen(next);
  }

  function selectDate(selected: Date | undefined) {
    if (!selected) return;
    if (includeTime) {
      setDraftDate(selected);
    } else {
      onChange(format(selected, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  function applyDateTime() {
    if (!inBounds) return;
    onChange(draft);
    setOpen(false);
  }

  return (
    <Popover open={open && !disabled} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          disabled={disabled}
          {...ariaProps}
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 text-left text-xs font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">
            {date
              ? format(date, includeTime ? "yyyy.MM.dd HH:mm" : "yyyy.MM.dd (eee)", { locale: ko })
              : placeholder ?? (includeTime ? "날짜와 시간 선택" : "날짜 선택")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        // Still scrolls when the screen is short, but without the (app-green) scrollbar.
        className="w-80 max-w-[calc(100vw-1rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        align="start"
        collisionPadding={8}
      >
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={includeTime ? draftDate : date}
          onSelect={selectDate}
          startMonth={minDate ?? new Date(1900, 0)}
          endMonth={maxDate ?? new Date(2100, 11)}
          disabled={(day) => Boolean((minDate && day < minDate) || (maxDate && day > maxDate))}
          autoFocus
        />
        {includeTime && (
          <div className="space-y-2 border-t px-3 py-3">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 shrink-0 text-muted-foreground" />
              <label htmlFor={timeId + "-hour"} className="sr-only">시 (00~23)</label>
              <Input
                id={timeId + "-hour"}
                inputMode="numeric"
                maxLength={2}
                value={hour}
                onChange={(event) => setHour(event.target.value.replace(/\D/g, ""))}
                onBlur={() => setHour((previous) => previous.padStart(2, "0"))}
                className="h-9 w-16 text-center tabular-nums"
                aria-invalid={Number(hour) > 23}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); applyDateTime(); }
                }}
              />
              <span className="text-sm text-muted-foreground">시</span>
              <label htmlFor={timeId + "-minute"} className="sr-only">분 (00~59)</label>
              <Input
                id={timeId + "-minute"}
                inputMode="numeric"
                maxLength={2}
                value={minute}
                onChange={(event) => setMinute(event.target.value.replace(/\D/g, ""))}
                onBlur={() => setMinute((previous) => previous.padStart(2, "0"))}
                className="h-9 w-16 text-center tabular-nums"
                aria-invalid={Number(minute) > 59}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); applyDateTime(); }
                }}
              />
              <span className="text-sm text-muted-foreground">분</span>
            </div>
            {draftDate && (!timeValid || !inBounds) && (
              <p className="text-xs text-destructive" role="status">
                {!timeValid ? "시와 분을 확인해주세요." : "선택 가능한 기간의 시간을 입력해주세요."}
              </p>
            )}
          </div>
        )}
        {(clearable || includeTime) && (
          <div className="flex items-center justify-end gap-2 border-t p-3">
            {clearable && (
              <Button type="button" variant="ghost" size="sm" className="mr-auto" disabled={!value}
                onClick={() => { onChange(""); setOpen(false); }}>
                지우기
              </Button>
            )}
            {includeTime && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
                <Button type="button" size="sm" disabled={!inBounds} onClick={applyDateTime}>적용</Button>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
