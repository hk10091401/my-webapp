type Props = { hair: string; shirt: string; skin?: string; size?: number; crown?: boolean };

/** 목록·프로필에 쓰는 작은 픽셀 얼굴 */
export default function Avatar({ hair, shirt, skin = "#f6d2b8", size = 32, crown = false }: Props) {
  return (
    <svg
      className="avatar"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="11" width="12" height="5" fill="#1f3a3d" />
      <rect x="3" y="12" width="10" height="4" fill={shirt} />
      <rect x="3" y="3" width="10" height="9" fill="#1f3a3d" />
      <rect x="4" y="4" width="8" height="7" fill={skin} />
      <rect x="4" y="3" width="8" height="3" fill={hair} />
      <rect x="4" y="6" width="1" height="2" fill={hair} />
      <rect x="11" y="6" width="1" height="2" fill={hair} />
      <rect x="6" y="8" width="1" height="1" fill="#1f3a3d" />
      <rect x="9" y="8" width="1" height="1" fill="#1f3a3d" />
      {crown ? (
        <>
          <rect x="5" y="1" width="6" height="1" fill="#f2b33d" />
          <rect x="5" y="0" width="1" height="1" fill="#f2b33d" />
          <rect x="7" y="0" width="2" height="1" fill="#f2b33d" />
          <rect x="10" y="0" width="1" height="1" fill="#f2b33d" />
        </>
      ) : null}
    </svg>
  );
}
