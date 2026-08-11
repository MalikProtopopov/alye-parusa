import type { SectionText, TeamMember } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { SafeImage } from "../primitives/SafeImage";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./TeamSection.module.css";

/** Two-letter monogram used while a portrait is missing or unreachable. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");
}

export function TeamSection({
  members,
  text,
}: {
  members: TeamMember[];
  text: SectionText;
}) {
  return (
    <Section id="team" tone="elevated">
      <Container>
        <SectionHeading
          variant="aside"
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead}
        />
        <div className={styles.grid}>
          {members.map((member, i) => (
            <Reveal key={member.id} delay={(i % 4) * 60}>
              <article className={styles.card}>
                <div className={styles.photo}>
                  <SafeImage
                    src={member.photoUrl}
                    alt={`Портрет: ${member.name}`}
                    kind="portrait"
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className={styles.img}
                    fallbackContent={
                      <span className={styles.initials} aria-hidden="true">
                        {initialsOf(member.name)}
                      </span>
                    }
                  />
                </div>
                <h3 className={styles.name}>{member.name}</h3>
                {member.role ? <p className={styles.role}>{member.role}</p> : null}
                {member.bio ? <p className={styles.bio}>{member.bio}</p> : null}
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
