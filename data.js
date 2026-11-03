// Демо-данные. В реальном проекте приходят с бэкенда.
// start — дата начала проката: до неё фильм в разделе «Скоро», с неё — в расписании.

const CINEMAS = [
  { id: "ala-too", name: "Джал Фильм Ала-Тоо", address: "пр. Чуй, 150", city: "Бишкек", halls: ["Зал 1", "Зал 2", "IMAX"] },
  { id: "asia", name: "Джал Фильм Asia Mall", address: "пр. Чуй, 215, 4 этаж", city: "Бишкек", halls: ["Зал 1", "Зал 2", "VIP"] },
  { id: "dordoi", name: "Джал Фильм Дордой Плаза", address: "ул. Ибраимова, 115", city: "Бишкек", halls: ["Зал 1", "Зал 3D"] },
  { id: "osh", name: "Джал Фильм Ош", address: "ул. Ленина, 205", city: "Ош", halls: ["Зал 1", "Зал 2"] },
];

const MOVIES = [
  { id: 1, title: "Айтматов", original: "Aitmatov", genre: ["Биография", "Драма"], age: "12+", duration: 135, rating: 8.6, country: "Кыргызстан", year: 2026,
    poster: "images/posters/aitmatov.jpg", colors: ["#2b2118", "#8a6a3f"], emoji: "📖", start: "2026-10-15",
    description: "Фильм о жизни Чингиза Айтматова — писателя, чьи книги прочитал весь мир, и о времени, в которое ему довелось жить и творить." },
  { id: 2, title: "Күл", original: "Kul", genre: ["Комедия", "Исторический"], age: "12+", duration: 110, rating: 7.9, country: "Кыргызстан", year: 2026,
    poster: "images/posters/kul.jpg", colors: ["#3b1d10", "#b5542a"], emoji: "🐎", start: "2026-10-29",
    description: "Историческая комедия с Динарой Багышбаевой в главной роли: у героини есть всего 20 дней, и за это время ей предстоит пройти через войну, интриги и много смешного." },
  { id: 3, title: "Жудомушов", original: "Judomushov", genre: ["Комедия", "Боевик"], age: "12+", duration: 100, rating: 7.4, country: "Кыргызстан", year: 2026,
    poster: "images/posters/judomushov.jpg", colors: ["#0f3d6e", "#e2b714"], emoji: "🚓", start: "2026-09-24",
    description: "Комедийный боевик о двух неудачливых милиционерах, которым неожиданно достаётся самое громкое дело в их карьере." },
  { id: 4, title: "Канжар", original: "Kanjar", genre: ["Боевик", "Триллер"], age: "16+", duration: 118, rating: 0, country: "Кыргызстан", year: 2026,
    poster: "images/posters/kanjar.jpg", colors: ["#13302c", "#6b1d1d"], emoji: "🗡️", start: "2026-11-06",
    description: "Остросюжетный боевик: девушке приходится в одиночку противостоять опасным людям, чтобы защитить тех, кто ей дорог." },
];

const FORMATS = ["2D", "3D", "IMAX"];
