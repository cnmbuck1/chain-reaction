import { gearPath } from './icons';

// The home screen's machine-room dressing: a title whose letters are machine parts, and
// gears and circuit traces behind the header. All decoration: hidden from screen readers.

const LETTER_GEAR = gearPath(10, 12, 9.4, 4.4);
const BIG_GEAR = gearPath(14, 50, 43, 15);
const SMALL_GEAR = gearPath(9, 30, 24, 9);

/** "Chain Reaction", with a circuit node for the i in Chain and a gear for the o in Reaction. */
export function HomeTitle() {
  return (
    <h1 className="home-title" aria-label="Chain Reaction">
      <span aria-hidden="true">
        Cha
        <svg className="letter-i" viewBox="0 0 10 30" aria-hidden="true">
          <path className="trace" d="M5 11V30" />
          <path className="spark" d="M5 30V11" pathLength="100" />
          <circle className="node-ring" cx="5" cy="5" r="3.9" />
          <circle className="node" cx="5" cy="5" r="2.1" />
        </svg>
        n Reacti
        <svg className="letter-o" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" d={LETTER_GEAR} />
        </svg>
        n
      </span>
    </h1>
  );
}

/** Two meshing gears behind the title. */
export function HomeBackdrop() {
  return (
    <div className="home-art" aria-hidden="true">
      <svg className="home-gears" viewBox="0 0 200 170">
        <g transform="translate(78 0)">
          <path className="spin-slow" fillRule="evenodd" d={BIG_GEAR} />
        </g>
        <g transform="translate(36 86)">
          <path className="spin-back" fillRule="evenodd" d={SMALL_GEAR} />
        </g>
      </svg>
    </div>
  );
}

/** Circuit traces under the header, with a pulse running along them. */
export function HomeTraces() {
  return (
    <div className="home-traces" aria-hidden="true">
      <svg viewBox="0 0 480 44">
        <path className="trace-line" d="M0 26H70L88 8H170L186 24H480" />
        <path className="trace-line" d="M0 40H40L52 30H120" />
        <path className="trace-pulse" d="M0 26H70L88 8H170L186 24H480" pathLength="100" />
        <circle className="trace-node" cx="70" cy="26" r="3" />
        <circle className="trace-node" cx="170" cy="8" r="3" />
        <circle className="trace-node" cx="120" cy="30" r="3" />
      </svg>
    </div>
  );
}
