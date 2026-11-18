"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { PeopleRingArt } from "./people-ring-art";
import styles from "./about-people.module.css";

const roles = [
  { key: "president", label: "학회장" },
  { key: "vicePresident", label: "부학회장" },
  { key: "treasurer", label: "총무" },
] as const;

type Executive = {
  year: string;
  president: string;
  vicePresident: string;
  treasurer: string;
};

export function AboutPeople({ executives }: { executives: Executive[] }) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);

  if (!executives.length) return null;

  const handleYearKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = executives.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    document.getElementById(`${baseId}-year-${next}`)?.focus();
  };

  return (
    <div className={styles.peopleLayout}>
      <PeopleRingArt years={executives.map(({ year }) => year)} selected={selected} />
      <div className={styles.directory}>
        <div className={styles.years} role="tablist" aria-label="연도별 운영진" aria-orientation="vertical">
          {executives.map(({ year }, index) => (
            <button
              key={year}
              className={styles.year}
              id={`${baseId}-year-${index}`}
              type="button"
              role="tab"
              aria-label={`${year}년`}
              aria-selected={selected === index}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => handleYearKey(event, index)}
            >
              {year}
            </button>
          ))}
        </div>
        <div className={styles.rosterArea}>
          {executives.map((executive, index) => (
            <div
              key={executive.year}
              id={`${baseId}-panel-${index}`}
              className={styles.rosterPanel}
              role="tabpanel"
              aria-labelledby={`${baseId}-year-${index}`}
              hidden={selected !== index}
              tabIndex={0}
            >
              <dl className={styles.roster}>
                {roles.map(({ key, label }) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{executive[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
