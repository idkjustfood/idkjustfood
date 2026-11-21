import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  BellRing,
  BookOpen,
  BookPlus,
  CalendarDays,
  Camera,
  Check,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  CloudOff,
  Code,
  Copy,
  CreditCard,
  Download,
  EllipsisVertical,
  FileCode,
  FileJson,
  FileText,
  Globe,
  Home,
  House,
  ImagePlus,
  KeyRound,
  Languages,
  Link2,
  LinkIcon,
  ListChecks,
  LogOut,
  Mic,
  MicOff,
  Minus,
  Package,
  PenLine,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  SearchX,
  Server,
  Settings,
  Share2,
  ShoppingCart,
  Sparkles,
  Store,
  Timer,
  Trash2,
  Unlink,
  Upload,
  User,
  UserMinus,
  UserPlus,
  Users,
  Video,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native"
import type { ReactNode } from "react"
import Svg, { Circle, Path } from "react-native-svg"

/**
 * The "cozy" icon set: our own soft, hand-drawn style icons. Round caps, slightly
 * wobbly lines and a light colour wash inside shapes. Drawn for this project, so
 * they come under the project's licence (see docs/themes.md).
 *
 * Each icon has the same props as a Lucide icon, so it can stand in for one.
 * `Icon` swaps them automatically when the theme asks for the cozy style.
 */

const WASH = 0.2

/** A line drawing. */
const line = (d: string, key?: string) => <Path key={key ?? d} d={d} />
/** A shape with a soft colour wash inside. */
const shape = (d: string, key?: string) => (
  <Path key={key ?? d} d={d} fill="currentColor" fillOpacity={WASH} />
)
const dot = (cx: number, cy: number, r = 1.2) => (
  <Circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" />
)
const ring = (cx: number, cy: number, r: number) => (
  <Circle
    key={`${cx},${cy},${r}`}
    cx={cx}
    cy={cy}
    r={r}
    fill="currentColor"
    fillOpacity={WASH}
  />
)

function make(name: string, children: ReactNode): LucideIcon {
  function CozyIcon({
    size = 24,
    strokeWidth = 2,
    color,
    ...props
  }: LucideProps) {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color ?? "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        color={color}
        {...(props as object)}
      >
        {children}
      </Svg>
    )
  }
  CozyIcon.displayName = `Cozy${name}`
  return CozyIcon as unknown as LucideIcon
}

const book = [
  shape(
    "M12 6.5 Q8 4.5 3.5 5.5 L3.5 18.5 Q8 17.5 12 19.5 Q16 17.5 20.5 18.5 L20.5 5.5 Q16 4.5 12 6.5 Z"
  ),
  line("M12 6.5 Q12.3 13 12 19.5"),
]
const page = [
  shape("M6 3.5 L14 3.5 L19 8.5 L19 20 Q12.5 20.5 6 20 Z"),
  line("M14 3.5 L14 8.5 L19 8.5"),
]
const house = [
  shape("M5.5 10.5 L12 5 L18.5 10.5 L18.5 19.5 Q12 20 5.5 19.5 Z"),
  line("M3.5 11.5 L12 4.5 L20.5 11.5"),
  line("M10 19.5 L10 14.5 L14 14.5 L14 19.5"),
]
const image = [
  shape("M4 6 Q12 5.5 20 6 L20 18 Q12 18.5 4 18 Z"),
  line("M4 16 Q8 12 11 15 Q14 11 20 16"),
  dot(9, 10, 1.4),
]
const link = [
  line("M9.5 14.5 L8 16 Q5.5 18.5 3.8 16.8 Q2 15 4.5 12.5 L7 10 Q9 8 11 10"),
  line(
    "M14.5 9.5 L16 8 Q18.5 5.5 20.2 7.2 Q22 9 19.5 11.5 L17 14 Q15 16 13 14"
  ),
  line("M9.5 14.5 Q12 12 14.5 9.5"),
]
const pencil = [
  shape("M4.5 19.5 L5.5 15 L15.5 5 Q17 4 18.5 5.5 Q20 7 19 8.5 L9 18.5 Z"),
  line("M13.5 7 L17 10.5"),
]
const mic = [
  shape(
    "M9.5 6 Q9.5 3.5 12 3.5 Q14.5 3.5 14.5 6 L14.5 11 Q14.5 13.5 12 13.5 Q9.5 13.5 9.5 11 Z"
  ),
  line("M6 11 Q6 16.5 12 16.5 Q18 16.5 18 11"),
  line("M12 16.5 L12 20.5 M9 20.5 L15 20.5"),
]
const user = [ring(12, 8, 3.5), line("M5 20 Q5 14 12 14 Q19 14 19 20")]

export const CozySearch = make("Search", [
  ring(10.5, 10.5, 6),
  line("M15 15 Q18 18 20 20"),
])

/** The cozy replacement for each Lucide icon used in the app. */
const cozyFor = new Map<LucideIcon, LucideIcon>([
  [Check, make("Check", [line("M5 12.5 Q8 14.5 10 17.5 Q12.5 11.5 19.5 6")])],
  [
    ChevronDown,
    make("ChevronDown", [line("M6 9.5 Q9 12.5 12 15 Q15 12 18 9.5")]),
  ],
  [
    ChevronLeft,
    make("ChevronLeft", [line("M14.5 6 Q11.5 9 9 12 Q11.5 15 14.5 18")]),
  ],
  [
    ChevronRight,
    make("ChevronRight", [line("M9.5 6 Q12.5 9 15 12 Q12.5 15 9.5 18")]),
  ],
  [X, make("X", [line("M6 6 Q12 12 18.5 18.5 M18 6 Q12 12 5.5 18.5")])],
  [Plus, make("Plus", [line("M12 5 Q12.5 12 12 19 M5 12 Q12 11.5 19 12")])],
  [Minus, make("Minus", [line("M5 12 Q12 11.5 19 12")])],
  [
    ArrowUp,
    make("ArrowUp", [
      line("M12 19 Q12.5 12 12 5 M6.5 10.5 Q9.5 8 12 5 Q14.5 8 17.5 10.5"),
    ]),
  ],
  [
    ArrowDown,
    make("ArrowDown", [
      line("M12 5 Q12.5 12 12 19 M6.5 13.5 Q9.5 16 12 19 Q14.5 16 17.5 13.5"),
    ]),
  ],
  [Search, CozySearch],
  [
    SearchX,
    make("SearchX", [
      ring(10.5, 10.5, 6),
      line("M15 15 Q18 18 20 20"),
      line("M8.3 8.3 L12.7 12.7 M12.7 8.3 L8.3 12.7"),
    ]),
  ],
  [
    Trash2,
    make("Trash2", [
      shape(
        "M6.5 7.5 Q7 14 7.5 19 Q8 20.5 9.5 20.5 L14.5 20.5 Q16 20.5 16.5 19 Q17 14 17.5 7.5 Z"
      ),
      line("M5 7 Q12 6.5 19 7 M9 7 Q9 5 10.5 4.5 L13.5 4.5 Q15 5 15 7"),
      line("M10 11 Q10 14 10 17 M14 11 Q14 14 14 17"),
    ]),
  ],
  [Pencil, make("Pencil", pencil)],
  [PenLine, make("PenLine", [...pencil, line("M13 20.5 Q17 20 20.5 20.5")])],
  [
    Settings,
    make("Settings", [
      ring(12, 12, 7),
      <Circle key="c" cx={12} cy={12} r={2.8} />,
      line(
        "M12 2.5 L12 4.5 M12 19.5 L12 21.5 M2.5 12 L4.5 12 M19.5 12 L21.5 12"
      ),
      line(
        "M5.3 5.3 L6.7 6.7 M17.3 17.3 L18.7 18.7 M18.7 5.3 L17.3 6.7 M6.7 17.3 L5.3 18.7"
      ),
    ]),
  ],
  [BookOpen, make("BookOpen", book)],
  [
    BookPlus,
    make("BookPlus", [...book, line("M17 8.5 L17 12.5 M15 10.5 L19 10.5")]),
  ],
  [
    ShoppingCart,
    make("ShoppingCart", [
      shape("M7 8 L19.5 8 L18 14.5 Q12.5 15 8 14.5 Z"),
      line("M3.5 5 Q5.5 5.2 7 5.5 L8 14.5 Q12 15 18 14.5 L19.5 8 L7.2 8"),
      <Circle key="w1" cx={9.5} cy={19} r={1.4} />,
      <Circle key="w2" cx={17} cy={19} r={1.4} />,
    ]),
  ],
  [
    Store,
    make("Store", [
      shape("M5.5 11.5 L5.5 19.5 Q12 20 18.5 19.5 L18.5 11.5 Z"),
      line(
        "M4 9.5 L5.5 4.5 Q12 4 18.5 4.5 L20 9.5 Q18.5 11.5 17 9.5 Q15.5 11.5 14 9.5 Q12.5 11.5 11 9.5 Q9.5 11.5 8 9.5 Q6.5 11.5 5 9.5 Z"
      ),
      line("M10 19.5 L10 15 L14 15 L14 19.5"),
    ]),
  ],
  [
    CalendarDays,
    make("CalendarDays", [
      shape("M4.5 6.5 Q12 6 19.5 6.5 L19.5 19.5 Q12 20 4.5 19.5 Z"),
      line("M8 4 L8 8 M16 4 L16 8 M4.5 10.5 Q12 10 19.5 10.5"),
      dot(8.5, 14.2),
      dot(12, 14.2),
      dot(15.5, 14.2),
    ]),
  ],
  [
    ChefHat,
    make("ChefHat", [
      shape(
        "M7 14.5 C4 14 3.5 9.5 6.5 8.5 C7 5.5 11 4.5 12.5 6.5 C14 4.5 18 5.5 18 8.5 C21 9.5 20 14 17 14.5 L17 19.5 Q12 20 7 19.5 Z"
      ),
      line("M7 17 Q12 17.4 17 17"),
    ]),
  ],
  [Clock, make("Clock", [ring(12, 12, 8.5), line("M12 7.5 L12 12 L15.5 14")])],
  [
    Timer,
    make("Timer", [
      ring(12, 13.5, 7.5),
      line("M10 3.5 L14 3.5 M12 3.5 L12 6"),
      line("M12 9.5 L12 13.5 L14.5 15"),
    ]),
  ],
  [
    BellRing,
    make("BellRing", [
      shape(
        "M6 16.5 Q7 14 7 10.5 Q7.5 6.5 12 6 Q16.5 6.5 17 10.5 Q17 14 18 16.5 Z"
      ),
      line("M10.5 19.5 Q12 21 13.5 19.5"),
      line("M3.5 9 Q3.8 7 5 5.5 M20.5 9 Q20.2 7 19 5.5"),
    ]),
  ],
  [
    Camera,
    make("Camera", [
      shape(
        "M4 8.5 Q4 7 5.5 7 L8 7 L9.5 5 L14.5 5 L16 7 L18.5 7 Q20 7 20 8.5 L20 17.5 Q20 19 18.5 19 L5.5 19 Q4 19 4 17.5 Z"
      ),
      <Circle key="l" cx={12} cy={12.5} r={3.2} />,
    ]),
  ],
  [
    ImagePlus,
    make("ImagePlus", [...image, line("M19 2.5 L19 7.5 M16.5 5 L21.5 5")]),
  ],
  [
    Video,
    make("Video", [
      shape("M4 7.5 Q9 7 14.5 7.5 L14.5 16.5 Q9 17 4 16.5 Z"),
      line("M14.5 11 L20 7.5 L20 16.5 L14.5 13"),
    ]),
  ],
  [Mic, make("Mic", mic)],
  [MicOff, make("MicOff", [...mic, line("M4 4 Q12 12 20 20")])],
  [
    AudioLines,
    make("AudioLines", [
      line(
        "M4 11 L4 13 M8 8 L8 16 M12 4.5 L12 19.5 M16 8 L16 16 M20 10.5 L20 13.5"
      ),
    ]),
  ],
  [
    Sparkles,
    make("Sparkles", [
      shape(
        "M11 4 Q11.5 9.5 17 11 Q11.5 12.5 11 18 Q10.5 12.5 5 11 Q10.5 9.5 11 4 Z"
      ),
      line(
        "M18.5 3.5 Q18.8 5.5 20.5 6 Q18.8 6.5 18.5 8.5 Q18.2 6.5 16.5 6 Q18.2 5.5 18.5 3.5 Z"
      ),
    ]),
  ],
  [User, make("User", user)],
  [
    Users,
    make("Users", [
      ring(9, 8.5, 3),
      line("M3.5 19.5 Q3.5 14.5 9 14.5 Q14.5 14.5 14.5 19.5"),
      line(
        "M15.5 5.5 Q18.5 5.8 18.5 8.5 Q18.5 11 15.5 11.5 M17 14.5 Q20.5 15 20.5 19.5"
      ),
    ]),
  ],
  [
    UserPlus,
    make("UserPlus", [
      ring(10, 8, 3.3),
      line("M3.5 19.5 Q3.5 14 10 14 Q14 14 15.5 16"),
      line("M18.5 8.5 L18.5 14.5 M15.5 11.5 L21.5 11.5"),
    ]),
  ],
  [
    UserMinus,
    make("UserMinus", [
      ring(10, 8, 3.3),
      line("M3.5 19.5 Q3.5 14 10 14 Q14 14 15.5 16"),
      line("M15.5 11.5 L21.5 11.5"),
    ]),
  ],
  [Home, make("Home", house)],
  [House, make("House", house)],
  [
    KeyRound,
    make("KeyRound", [
      ring(8.5, 15.5, 4),
      line("M11.5 12.5 L19.5 4.5 M16.5 7.5 L18.5 9.5"),
    ]),
  ],
  [
    LogOut,
    make("LogOut", [
      line("M10 4.5 L5 4.5 Q4.5 4.5 4.5 5 L4.5 19 Q4.5 19.5 5 19.5 L10 19.5"),
      line("M9.5 12 L20 12 M16 8 L20 12 L16 16"),
    ]),
  ],
  [
    Languages,
    make("Languages", [
      shape(
        "M3.5 5.5 Q9 5 14 5.5 L14 13.5 Q10 14 7 14 L4.5 16.5 L4.5 14 Q3.5 14 3.5 13 Z"
      ),
      line("M6 11.5 L8.5 7 L11 11.5 M6.9 10 L10.1 10"),
      line(
        "M15 9.5 L20 9.5 Q20.5 9.5 20.5 10 L20.5 17 Q20.5 17.5 20 17.5 L19 17.5 L19 20 L16.5 17.5 L15 17.5 Q14.5 17.5 14.5 17 L14.5 10 Q14.5 9.5 15 9.5 Z"
      ),
    ]),
  ],
  [
    Globe,
    make("Globe", [
      ring(12, 12, 8.5),
      line("M3.5 12 Q12 13 20.5 12"),
      line("M12 3.5 Q8 12 12 20.5 Q16 12 12 3.5"),
    ]),
  ],
  [
    Package,
    make("Package", [
      shape("M4.5 8 L12 4.5 L19.5 8 L19.5 16.5 L12 20 L4.5 16.5 Z"),
      line("M4.5 8 L12 11.5 L19.5 8 M12 11.5 L12 20"),
    ]),
  ],
  [
    RotateCcw,
    make("RotateCcw", [
      line(
        "M5 12 Q5 5.5 12 5.5 Q19 5.5 19 12 Q19 18.5 12 18.5 Q8.5 18.5 6.3 16"
      ),
      line("M4.5 5.5 L4.5 10.5 L9.5 10.5"),
    ]),
  ],
  [
    Repeat,
    make("Repeat", [
      line("M5 11 Q5 7.5 8.5 7.5 L18.5 7.5 M16 4.5 L19 7.5 L16 10.5"),
      line("M19 13 Q19 16.5 15.5 16.5 L5.5 16.5 M8 13.5 L5 16.5 L8 19.5"),
    ]),
  ],
  [
    Unlink,
    make("Unlink", [
      line("M10 14 L8 16 Q5.5 18.5 3.8 16.7 Q2 14.8 4.5 12.3 L6.5 10.3"),
      line("M14 10 L16 8 Q18.5 5.5 20.2 7.3 Q22 9.2 19.5 11.7 L17.5 13.7"),
      line("M9 5 L10 7.5 M5 9 L7.5 10 M15 19 L14 16.5 M19 15 L16.5 14"),
    ]),
  ],
  [Link2, make("Link2", link)],
  [LinkIcon, make("LinkIcon", link)],
  [
    Copy,
    make("Copy", [
      shape(
        "M9 9 Q9 8 10 8 L19 8 Q20 8 20 9 L20 19 Q20 20 19 20 L10 20 Q9 20 9 19 Z"
      ),
      line(
        "M15.5 8 L15.5 5 Q15.5 4 14.5 4 L5 4 Q4 4 4 5 L4 15 Q4 16 5 16 L9 16"
      ),
    ]),
  ],
  [
    Share2,
    make("Share2", [
      ring(18, 6, 2.6),
      ring(6, 12, 2.6),
      ring(18, 18, 2.6),
      line("M8.2 10.8 L15.8 7.2 M8.2 13.2 L15.8 16.8"),
    ]),
  ],
  [
    Download,
    make("Download", [
      line("M4.5 15 L4.5 19 Q12 19.5 19.5 19 L19.5 15"),
      line("M12 4.5 L12 15 M7.5 10.5 L12 15 L16.5 10.5"),
    ]),
  ],
  [
    Upload,
    make("Upload", [
      line("M4.5 15 L4.5 19 Q12 19.5 19.5 19 L19.5 15"),
      line("M12 15.5 L12 5 M7.5 9 L12 4.5 L16.5 9"),
    ]),
  ],
  [
    FileText,
    make("FileText", [...page, line("M9 13 L16 13 M9 16.5 L14 16.5")]),
  ],
  [
    FileCode,
    make("FileCode", [
      ...page,
      line("M10 12.5 L8 15 L10 17.5 M14 12.5 L16 15 L14 17.5"),
    ]),
  ],
  [
    FileJson,
    make("FileJson", [
      ...page,
      line("M10.5 12.5 Q9 12.5 9 14 Q9 15 8.2 15 Q9 15 9 16 Q9 17.5 10.5 17.5"),
      line(
        "M13.5 12.5 Q15 12.5 15 14 Q15 15 15.8 15 Q15 15 15 16 Q15 17.5 13.5 17.5"
      ),
    ]),
  ],
  [
    Code,
    make("Code", [line("M8.5 7 L3.5 12 L8.5 17 M15.5 7 L20.5 12 L15.5 17")]),
  ],
  [
    CreditCard,
    make("CreditCard", [
      shape("M3.5 6.5 Q12 6 20.5 6.5 L20.5 17.5 Q12 18 3.5 17.5 Z"),
      line("M3.5 10.5 Q12 10 20.5 10.5 M7 14.5 L11 14.5"),
    ]),
  ],
  [
    Server,
    make("Server", [
      shape("M4.5 5 Q12 4.5 19.5 5 L19.5 10.5 Q12 11 4.5 10.5 Z"),
      shape("M4.5 13.5 Q12 13 19.5 13.5 L19.5 19 Q12 19.5 4.5 19 Z"),
      dot(7.8, 7.8),
      dot(7.8, 16.3),
    ]),
  ],
  [
    CloudOff,
    make("CloudOff", [
      shape(
        "M7 18.5 Q3.5 18.5 3.5 15 Q3.5 12 6.5 11.5 Q7 7.5 11.5 7 Q14.5 6.8 16 9 Q20.5 9.5 20.5 14 Q20.5 18.5 16.5 18.5 Z"
      ),
      line("M4 4 Q12 12 20 20"),
    ]),
  ],
  [
    CircleAlert,
    make("CircleAlert", [
      ring(12, 12, 8.5),
      line("M12 7.5 L12 13"),
      dot(12, 16.3, 0.9),
    ]),
  ],
  [
    EllipsisVertical,
    make("EllipsisVertical", [
      dot(12, 5.5, 1.5),
      dot(12, 12, 1.5),
      dot(12, 18.5, 1.5),
    ]),
  ],
  [
    ListChecks,
    make("ListChecks", [
      line(
        "M4 7 L5.5 8.5 L8.5 5 M4 15 L5.5 16.5 L8.5 13 M12 7 Q16 6.8 20 7 M12 15 Q16 14.8 20 15"
      ),
    ]),
  ],
])

/** The cozy version of a Lucide icon, or the icon itself when there is none. */
export function cozyIcon(icon: LucideIcon): LucideIcon {
  return cozyFor.get(icon) ?? icon
}

// Illustrations for common recipe categories, keyed by tag.
const bowl = shape("M3.5 12 Q3.5 19.5 12 19.5 Q20.5 19.5 20.5 12 Z")

export const categoryIcons: Record<string, LucideIcon> = {
  soup: make("Soup", [
    bowl,
    line("M3 12 L21 12"),
    line(
      "M8 8.5 Q9.5 6.5 8 4.5 M12 8.5 Q13.5 6.5 12 4.5 M16 8.5 Q17.5 6.5 16 4.5"
    ),
  ]),
  salad: make("Salad", [
    bowl,
    line("M3 12 L21 12"),
    line(
      "M7 11 Q6 6.5 10 6 Q11 9 7 11 Z M13 11 Q12 5.5 16.5 6 Q17.5 9 13 11 Z"
    ),
  ]),
  pasta: make("Pasta", [
    bowl,
    line("M3 12 L21 12"),
    line("M7 12 Q8 6 12 5 Q11 9.5 12 12 M12 12 Q14 7 18 6.5 Q16 9 16.5 12"),
  ]),
  pizza: make("Pizza", [
    shape("M3.5 6.5 Q12 2.5 20.5 6.5 L12 21 Z"),
    line("M3.5 6.5 Q12 2.5 20.5 6.5 L12 21 Z"),
    ring(9.5, 8.5, 1.3),
    ring(14, 9.5, 1.3),
    ring(12, 14, 1.3),
  ]),
  dessert: make("Dessert", [
    shape("M6 11 L7.5 20 Q12 20.5 16.5 20 L18 11 Z"),
    line("M5 11 Q7 4.5 12 5 Q17 4.5 19 11 Z"),
    dot(12, 3.5, 1.3),
  ]),
  breakfast: make("Breakfast", [
    shape(
      "M5 12 Q3 6.5 9 5 Q15 3.5 18.5 8 Q21 12.5 16.5 17.5 Q11 21 6.5 17 Q4.5 15 5 12 Z"
    ),
    ring(11.5, 11.5, 3),
  ]),
}
