import type { Flythrough, FrameSequenceMedia, RenderImage } from "@/domain";

/**
 * Paths point at /public/media, produced by scripts/prepare-media.sh from the
 * source clips in ../materials/seedance-output. Keep in sync with that script.
 */
/** Единственная сцена hero: «День → Ночь». Второй вариант («Дневная стройка»)
 *  и переключатель в шапке убраны — посетителю не нужен выбор режима видео. */
export const heroVariants: FrameSequenceMedia[] = [
  {
    id: "day-night",
    label: "День → Ночь",
    manifestUrl: "/media/hero/frames/manifest.json",
    poster: "/media/hero/poster.jpg",
    fallbackVideo: "/media/hero/morph-hero.mp4",
    aspectRatio: 16 / 9,
  },
];

export const flythroughs: Flythrough[] = [
  {
    id: "f1-aerial-to-waterfront",
    title: "Сверху — к воде",
    caption: "Спуск от панорамы квартала к набережной и бассейну.",
    video: "/media/flythroughs/f1-aerial-to-waterfront.mp4",
    poster: "/media/flythroughs/f1-aerial-to-waterfront.jpg",
  },
  {
    id: "f2-commercial-to-beachfront",
    title: "Улица у моря",
    caption: "От бульвара с коммерцией — к панораме пляжа.",
    video: "/media/flythroughs/f2-commercial-to-beachfront.mp4",
    poster: "/media/flythroughs/f2-commercial-to-beachfront.jpg",
  },
  {
    id: "f3-waterfront-to-beachfront",
    title: "Набережная",
    caption: "От пирса вдоль берега — к виду первой линии.",
    video: "/media/flythroughs/f3-waterfront-to-beachfront.mp4",
    poster: "/media/flythroughs/f3-waterfront-to-beachfront.jpg",
  },
];

export const renders: RenderImage[] = [
  {
    id: "aerial-panorama",
    src: "/media/renders/aerial-panorama.jpg",
    alt: "Аэро-панорама квартала «Алые Паруса» у моря",
    width: 1538,
    height: 1022,
  },
  {
    id: "aerial-beachfront",
    src: "/media/renders/aerial-beachfront.jpg",
    alt: "Квартал у пляжа с бассейном, вид с высоты",
    width: 1608,
    height: 978,
  },
  {
    id: "twin-towers-waterfront",
    src: "/media/renders/twin-towers-waterfront.jpg",
    alt: "Корпуса у воды, бассейн и понтон",
    width: 1553,
    height: 1014,
  },
  {
    id: "alley",
    src: "/media/renders/alley.jpg",
    alt: "Пешеходная аллея между корпусами",
    width: 1531,
    height: 1028,
  },
  {
    id: "commercial-street",
    src: "/media/renders/commercial-street.jpg",
    alt: "Улица с коммерцией на первых этажах",
    width: 1538,
    height: 1022,
  },
  {
    id: "fishing-pier",
    src: "/media/renders/fishing-pier.jpg",
    alt: "Набережная с пирсом и центральной аллеей",
    width: 1538,
    height: 1022,
  },
];
