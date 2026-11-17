import { AboutActivityDial } from "@/components/custom/about/about-activity-dial";
import { HomeScrollDivider } from "@/components/custom/home-scroll-divider";
import { ABOUT_SECTIONS } from "@/lib/about-sections";
import styles from "./about.module.css";

const EXECUTIVES = [
  { year: "2026", president: "천우영", vicePresident: "손기령", treasurer: "홍준영" },
  { year: "2025", president: "방가연", vicePresident: "이서연", treasurer: "조윤상" },
  { year: "2024", president: "정준하", vicePresident: "이하윤", treasurer: "김태경" },
  { year: "2023", president: "정한결", vicePresident: "이소영", treasurer: "한석기" },
  { year: "2022", president: "남정연", vicePresident: "박준서", treasurer: "강승묵" },
  { year: "2021", president: "이동주", vicePresident: "", treasurer: "" },
];

const EXECUTIVE_ROLES = [
  { key: "president", label: "학회장" },
  { key: "vicePresident", label: "부학회장" },
  { key: "treasurer", label: "총무" },
] as const;

function AboutDivider() {
  return (
    <div className={styles.divider}>
      <HomeScrollDivider />
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="about-title">
        <h1 id="about-title" className={styles.heroTitle}>
          <span>About</span>{" "}
          <span>Us</span>
        </h1>
        <p className={styles.heroCopy}>
          웹과 시스템을 함께 배우고,<br />
          아이디어를 실제 서비스로 만드는<br />
          서강대학교 컴퓨터공학과 학회입니다.
        </p>
      </section>

      <AboutDivider />
      <AboutActivityDial items={ABOUT_SECTIONS} />
      <AboutDivider />

      <section id="executives" className={styles.people} aria-labelledby="people-title">
        <div className={styles.peopleHeading}>
          <h2 id="people-title">People</h2>
          <p>역대 운영진</p>
        </div>
        <table className={styles.peopleTable} aria-label="역대 운영진">
          <thead>
            <tr>
              <th scope="col" lang="en">Year</th>
              {EXECUTIVE_ROLES.map((role) => (
                <th key={role.key} scope="col">{role.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXECUTIVES.map((executive) => (
              <tr key={executive.year}>
                <th scope="row">{executive.year}</th>
                {EXECUTIVE_ROLES.map((role) => (
                  <td key={role.key}>
                    {executive[role.key]
                      ? <span className={styles.peopleName}>{executive[role.key]}</span>
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
