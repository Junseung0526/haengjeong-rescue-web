// 물결은 그림 밖까지 길게 그려 넓은 화면·흐르는 움직임에도 끝이 보이지 않게 한다
const wave = (y, a, o = 0) => `M${-480 - o} ${y}` + Array.from({ length: 24 }, (_, k) => ` q 40 ${k % 2 ? a : -a} 80 0`).join('')

// 진주 풍경 선화: 남강 물결 위 촉석루를 선으로 그린 진주 풍경 (장식용)
export function JinjuScape() {
  return (
    <svg className="auth-scape" viewBox="0 0 800 230" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <path d="M-400 140 Q -200 116 0 150 Q 90 108 190 132 T 380 128 Q 430 120 460 134" />
      <path d="M770 136 Q 820 112 900 122 T 1200 128" />
      <defs>
        <clipPath id="roof-lo"><path d="M418 118 Q 452 114 470 104 L 506 78 L 614 78 L 650 104 Q 668 114 702 118 L 646 110 L 474 110 Z" /></clipPath>
        <clipPath id="roof-up"><path d="M494 78 L 512 58 L 608 58 L 626 78 Z" /></clipPath>
      </defs>
      <g className="pavilion" transform="translate(80 0)">
        {/* 아래 지붕: 끝이 살짝 들린 처마선, 기와골, 처마 밑 서까래 끝 */}
        <path d="M418 118 Q 452 114 470 104 L 506 78 L 614 78 L 650 104 Q 668 114 702 118" />
        <path d="M418 118 q -5 -1 -9 -8 M702 118 q 5 -1 9 -8" />
        <path className="fine" d="M424 121 Q 456 118 474 110 L 646 110 Q 664 118 696 121" />
        <g clipPath="url(#roof-lo)">{Array.from({ length: 15 }, (_, k) => { const x = 504 + k * 8; return <path key={k} className="fine" d={`M${x} 78 L ${560 + (x - 560) * 1.62} 110`} /> })}</g>
        {Array.from({ length: 29 }, (_, k) => <path key={k} className="fine" d={`M${476 + k * 6} 110 l 0 3`} />)}
        {/* 위 지붕(팔작): 용마루 양끝 취두, 기와골 */}
        <path d="M494 78 L 512 58 L 608 58 L 626 78" />
        <path d="M510 58 Q 560 53 610 58 M510 58 q -4 0 -6 -6 M610 58 q 4 0 6 -6" />
        <g clipPath="url(#roof-up)">{Array.from({ length: 11 }, (_, k) => { const x = 520 + k * 8; return <path key={k} className="fine" d={`M${x} 58 L ${560 + (x - 560) * 1.25} 78`} /> })}</g>
        {/* 공포대와 기둥, 누마루 난간 */}
        <path d="M466 116 L 654 116" />
        <path className="fine" d="M472 119 L 648 119" />
        {Array.from({ length: 9 }, (_, k) => <path key={k} d={`M${480 + k * 20} 116 L ${480 + k * 20} 146`} />)}
        {Array.from({ length: 8 }, (_, k) => <path key={k} className="fine" d={`M${484 + k * 20} 116 l 6 4 l 6 -4`} />)}
        <path d="M470 132 L 650 132" />
        <path className="fine" d="M470 127 L 650 127" />
        {Array.from({ length: 36 }, (_, k) => <path key={k} className="fine" d={`M${472 + k * 5} 127 l 0 5`} />)}
        <path d="M456 146 L 664 146" />
        <path className="fine" d="M462 140 L 658 140" />
      </g>
      <g className="wall" transform="translate(80 0)">
        <path d="M440 146 L 432 182 L 688 182 L 680 146" />
        {[158, 170].map((y) => <path key={y} d={`M${436} ${y} L ${684} ${y}`} />)}
        {Array.from({ length: 12 }, (_, k) => <path key={k} d={`M${452 + k * 20 + (k % 2) * 10} ${146 + (k % 3) * 12} l 0 12`} />)}
      </g>
      {[192, 204, 216, 228].map((y, k) => <path key={y} className="wave" style={{ '--t': `${11 - k * 1.6}s` }} d={wave(y, 3 - k * 0.4, k * 20)} />)}
    </svg>
  )
}

