"use client";

import { Calendar as SharedCalendar } from "@/components/ui/calendar";
import styles from "./booking.module.css";
import {
  fromDateStr,
  isReservableDate,
  maxReservationDateStr,
  toDateStr,
  todayStr,
} from "@/lib/online-lecture/date";

interface Props {
  selected: string;
  onSelect: (date: string) => void;
}

export default function Calendar({ selected, onSelect }: Props) {
  const today = todayStr();
  return (
    <section className={styles.outlined}>
      <h2 className={styles.sectionTitle}>날짜 선택</h2>
      <SharedCalendar
        className="mx-auto mt-3 w-full p-0 [--cell-size:2rem]"
        captionLayout="label"
        weekStartsOn={1}
        mode="single"
        selected={fromDateStr(selected)}
        defaultMonth={fromDateStr(selected)}
        startMonth={fromDateStr(today)}
        endMonth={fromDateStr(maxReservationDateStr(today))}
        disabled={(day) => !isReservableDate(toDateStr(day), today)}
        onSelect={(day) => { if (day) onSelect(toDateStr(day)); }}
      />
    </section>
  );
}
