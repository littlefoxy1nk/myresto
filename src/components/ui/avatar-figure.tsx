import {
  AVATAR_EYE_COLORS,
  AVATAR_HAIR_COLORS,
  AVATAR_SKINS,
  colorOf,
  shade,
  type AvatarConfig,
} from "@/lib/avatar";

const CAP = "M27 46 C25 27 37 20 50 20 C63 20 75 27 73 46 C70 37 62 32 50 32 C38 32 30 37 27 46 Z";

/// Le bonhomme d'une personne, dessiné en SVG à partir de ses choix (voir lib/avatar.ts).
/// Les couleurs de fond et de tenue suivent le thème de l'appli.
export function AvatarFigure({
  config,
  size = 40,
  title,
  className,
}: {
  config: AvatarConfig;
  size?: number;
  title?: string;
  className?: string;
}) {
  const skin = colorOf(AVATAR_SKINS, config.skin);
  const skinShade = shade(skin, 0.13);
  const hair = colorOf(AVATAR_HAIR_COLORS, config.hair);
  const hairShade = shade(hair, 0.2);
  const eyes = colorOf(AVATAR_EYE_COLORS, config.eyes);
  const woman = config.gender === "woman";
  const style = config.hairStyle;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      // Rond par simple arrondi : pas d'identifiant de découpe partagé entre plusieurs bonshommes
      // (un identifiant en double, dont le premier est dans un menu caché, casse le rendu).
      style={{ borderRadius: "50%", overflow: "hidden" }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g>
        <rect width="100" height="100" fill="var(--accent-soft)" />

        {/* cheveux derrière la tête */}
        {style === "long" && (
          <path d="M25 46 C21 70 23 90 31 98 L69 98 C77 90 79 70 75 46 C75 30 63 18 50 18 C37 18 25 30 25 46 Z" fill={hair} />
        )}
        {style === "bob" && (
          <path d="M25 46 C22 62 25 72 33 74 L67 74 C75 72 78 62 75 46 C75 30 63 18 50 18 C37 18 25 30 25 46 Z" fill={hair} />
        )}
        {style === "ponytail" && <path d="M66 36 C90 38 91 68 78 82 C78 68 72 58 66 52 Z" fill={hair} />}
        {style === "bun" && (
          <>
            <circle cx="50" cy="14" r="10.5" fill={hair} />
            <circle cx="53" cy="12" r="4" fill={hairShade} opacity="0.35" />
          </>
        )}
        {style === "curly" && (
          <>
            {[
              [30, 36, 9],
              [40, 26, 10],
              [50, 23, 10],
              [60, 26, 10],
              [70, 36, 9],
              [26, 48, 7],
              [74, 48, 7],
            ].map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={hair} />
            ))}
          </>
        )}

        {/* cou et épaules */}
        <rect x="43" y="60" width="14" height="20" rx="6" fill={skinShade} />
        <path d="M12 100 C12 82 28 74 50 74 C72 74 88 82 88 100 Z" fill="var(--accent)" />
        <path d="M42 75 L50 86 L58 75" fill="none" stroke="var(--accent-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />

        {/* oreilles et tête */}
        <circle cx="28" cy="49" r="4.4" fill={skin} />
        <circle cx="72" cy="49" r="4.4" fill={skin} />
        <ellipse cx="50" cy="46" rx={woman ? 21.5 : 22.5} ry="24.5" fill={skin} />

        {/* cheveux devant */}
        {style !== "bald" && style !== "curly" && <path d={CAP} fill={hair} />}
        {style === "bob" && (
          <>
            <path d="M27 46 C25 56 26 66 30 70 C31 60 31 52 33 44 Z" fill={hair} />
            <path d="M73 46 C75 56 74 66 70 70 C69 60 69 52 67 44 Z" fill={hair} />
          </>
        )}
        {style === "long" && (
          <>
            <path d="M27 46 C24 62 25 76 30 86 C32 72 32 56 34 42 Z" fill={hair} />
            <path d="M73 46 C76 62 75 76 70 86 C68 72 68 56 66 42 Z" fill={hair} />
          </>
        )}
        {style === "bun" && <ellipse cx="50" cy="22" rx="6.5" ry="2.2" fill={hairShade} />}
        {style === "ponytail" && <circle cx="67" cy="37" r="2.6" fill={hairShade} />}
        {style === "curly" && (
          <>
            {[
              [33, 34, 7],
              [42, 29, 7.5],
              [50, 28, 7.5],
              [58, 29, 7.5],
              [67, 34, 7],
              [28, 44, 5],
              [72, 44, 5],
            ].map(([cx, cy, r]) => (
              <circle key={`f-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={hair} />
            ))}
          </>
        )}

        {/* visage */}
        {[41, 59].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="47" rx="4.8" ry="3.8" fill="#fff" />
            <circle cx={cx} cy="47" r="2.8" fill={eyes} />
            <circle cx={cx} cy="47" r="1.3" fill="#1b1b1b" />
            <circle cx={cx + 0.9} cy="46" r="0.75" fill="#fff" />
          </g>
        ))}
        {woman && (
          <path
            d="M35.8 46 Q41 41.8 46.2 46 M53.8 46 Q59 41.8 64.2 46 M35.8 46 L34.6 44.6 M64.2 46 L65.4 44.6"
            fill="none"
            stroke="#2a2220"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        )}
        <path d="M35.5 41 Q41 38.4 46 41" fill="none" stroke={hair} strokeWidth={woman ? 1.5 : 2.3} strokeLinecap="round" />
        <path d="M54 41 Q59 38.4 64.5 41" fill="none" stroke={hair} strokeWidth={woman ? 1.5 : 2.3} strokeLinecap="round" />
        <path d="M49 51.5 Q50.2 56 52 53.4" fill="none" stroke={skinShade} strokeWidth="1.3" strokeLinecap="round" />
        {woman ? (
          <>
            <path d="M44.6 60 Q50 64.6 55.4 60 Q50 61.8 44.6 60 Z" fill="#c4574f" />
            <circle cx="35.5" cy="55.5" r="3.4" fill="#e8837a" opacity="0.22" />
            <circle cx="64.5" cy="55.5" r="3.4" fill="#e8837a" opacity="0.22" />
          </>
        ) : (
          <path d="M45 60.4 Q50 63.8 55 60.4" fill="none" stroke="#9a4a42" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}
