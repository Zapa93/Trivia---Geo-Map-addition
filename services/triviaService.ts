import { CategoryColumn, ProcessedQuestion, TriviaCategory, ItunesTrack } from '../types';
import { 
  ARTISTS_ROCK, 
  ARTISTS_80S, 
  ARTISTS_90S, 
  ARTISTS_2000S, 
  ARTISTS_2010S, 
  ARTISTS_HIPHOP, 
  MOVIE_THEMES,
  FOOTBALL_CAREERS
} from './musicData';
import { GEO_MAPS_DATA } from './geoMapsData';
import { decodeHtml } from '../utils/helpers';

const OPENTDB_API_URL = 'https://opentdb.com/api.php';
const ITUNES_API_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';
const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,flags,capital,population,independent,region,subregion';
const TMDB_API_URL = 'https://api.themoviedb.org/3/discover/movie';
const TRIVIA_API_URL = 'https://the-trivia-api.com/v2/questions';

const PLAYED_ITEMS_KEY = 'trivia_played_items_v2';
let openTdbToken: string | null = null;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Persistent History Helpers ---

const getPlayedItems = (): string[] => {
  try {
    const stored = localStorage.getItem(PLAYED_ITEMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn("Failed to read played items", e);
    return [];
  }
};

const savePlayedItem = (id: string) => {
  try {
    const current = getPlayedItems();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(PLAYED_ITEMS_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.warn("Failed to save played item", e);
  }
};

export const resetPlayedTracks = () => {
  localStorage.removeItem(PLAYED_ITEMS_KEY);
};

export const clearSpecificHistory = (type: 'music' | 'geo' | 'visual' | 'otdb' | 'all') => {
  if (type === 'all') {
    localStorage.removeItem(PLAYED_ITEMS_KEY);
    return;
  }

  const current = getPlayedItems();
  const keep = current.filter(id => {
    if (type === 'music') return !id.startsWith('music-') && !id.startsWith('song_');
    if (type === 'geo') return !id.startsWith('geo-') && !id.startsWith('map-');
    if (type === 'visual') return !id.startsWith('mov-') && !id.startsWith('fc-'); 
    // Rensar både OpenTDB (otdb-) och Trivia API (triv-) om man väljer "Text Questions"
    if (type === 'otdb') return !id.startsWith('otdb-') && !id.startsWith('triv-'); 
    return true;
  });
  
  localStorage.setItem(PLAYED_ITEMS_KEY, JSON.stringify(keep));
};

const getOpenTdbToken = async (): Promise<string | null> => {
  if (openTdbToken) return openTdbToken;
  try {
    const res = await fetch('https://opentdb.com/api_token.php?command=request');
    const data = await res.json();
    if (data.response_code === 0) {
      console.log("Ny OpenTDB Token skapad:", data.token);
      openTdbToken = data.token;
      return data.token;
    }
  } catch (e) {
    console.warn("Kunde inte skapa token, kör utan.", e);
  }
  return null;
};

const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getOpenTDBCategoryId = (id: string): number => {
  const map: Record<string, number> = {
    'otdb_general': 9,
    'otdb_videogames': 15,
    'otdb_computers': 18,
    'otdb_geography': 22,
    'otdb_history': 23,
    'otdb_film': 11,
    // Övriga som fallback ifall gamla IDn ligger kvar
    'otdb_music': 12,
    'otdb_tv': 14,
    'otdb_cartoons': 32,
    'otdb_science': 17,
    'otdb_math': 19,
    'otdb_gadgets': 30,
    'otdb_mythology': 20,
    'otdb_sports': 21,
    'otdb_politics': 24,
    'otdb_art': 25,
    'otdb_celebs': 26,
    'otdb_animals': 27,
    'otdb_vehicles': 28
  };
  return map[id] || 9;
};

const getDecadeRange = (catId: string): { start: number, end: number } | null => {
  switch (catId) {
    case 'music_80s': return { start: 1980, end: 1989 };
    case 'music_90s': return { start: 1990, end: 1999 };
    case 'music_2000s': return { start: 2000, end: 2009 };
    case 'music_2010s': return { start: 2010, end: 2019 };
    default: return null;
  }
};

const generateSongKey = (artist: string, title: string): string => {
  const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, '');
  return `song_${normalize(artist)}_${normalize(title)}`;
};

type MusicItem = 
  | string 
  | { artist: string; limit?: number } 
  | { title: string; artist: string } 
  | { title: string; id: number };

interface Country {
  name: { common: string };
  flags: { svg: string; png: string };
  capital: string[];
  population: number;
  independent: boolean;
  region: string;
  subregion: string;
}

// --- Logic A: Music (iTunes) ---
const fetchFromMixedList = async (list: MusicItem[], cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const decadeRange = getDecadeRange(cat.id);
  const shuffledList = shuffle([...list]); 
  const questions: ProcessedQuestion[] = [];
  const isMovieCat = cat.id === 'music_movies';
  const POINT_VALUE = 400;
  const TIMER_DURATION = isMovieCat ? 25 : 15;

  for (const item of shuffledList) {
    if (questions.length >= 5) break;

    let url = '';
    let manualTitle: string | null = null;
    let isIdLookup = false;
    const isSpecificRequest = typeof item !== 'string' && 'title' in item;

    if (typeof item === 'string') {
        const term = encodeURIComponent(item);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=25&country=US`;
    } else if ('id' in item) {
        isIdLookup = true;
        url = `${ITUNES_LOOKUP_URL}?id=${item.id}&country=US`;
        manualTitle = item.title;
    } else if ('title' in item) {
        const query = `${item.title} ${item.artist}`;
        const term = encodeURIComponent(query);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=5&country=US`;
        manualTitle = item.title;
    } else {
        const limit = item.limit || 25;
        const term = encodeURIComponent(item.artist);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=${limit}&country=US`;
        manualTitle = null;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      let validTracks: ItunesTrack[] = [];

      if (isIdLookup) {
          validTracks = (data.results || []).filter((t: any) => t.previewUrl);
      } else {
          validTracks = (data.results || []).filter((t: any) => t.previewUrl && t.kind === 'song');
          if (typeof item === 'string') {
              const searchArtist = item.toLowerCase();
              validTracks = validTracks.filter((t: ItunesTrack) => {
                 const artistLower = (t.artistName || "").toLowerCase();
                 const trackLower = (t.trackName || "").toLowerCase();
                 const collectionLower = (t.collectionName || "").toLowerCase();
                 if (!artistLower.includes(searchArtist)) return false;
                 const forbiddenTerms = ["tribute", "cover", "karaoke"];
                 if (forbiddenTerms.some(term => trackLower.includes(term))) return false;
                 if (forbiddenTerms.some(term => collectionLower.includes(term))) return false;
                 if (forbiddenTerms.some(term => artistLower.includes(term))) return false;
                 return true;
              });
          }
          if (typeof item !== 'string' && 'artist' in item) {
              const requiredArtist = item.artist.toLowerCase();
              validTracks = validTracks.filter((t: ItunesTrack) => {
                  const artistLower = (t.artistName || "").toLowerCase();
                  if (!artistLower.includes(requiredArtist)) return false;
                  if (!('title' in item)) {
                      const trackLower = (t.trackName || "").toLowerCase();
                      const collectionLower = (t.collectionName || "").toLowerCase();
                      const forbiddenTerms = ["tribute", "cover", "karaoke"];
                      if (forbiddenTerms.some(term => trackLower.includes(term))) return false;
                      if (forbiddenTerms.some(term => collectionLower.includes(term))) return false;
                      if (forbiddenTerms.some(term => artistLower.includes(term))) return false;
                  }
                  return true;
              });
          }
      }

      if (decadeRange && !isIdLookup) {
         validTracks = validTracks.filter(t => {
            if (!t.releaseDate) return false;
            const releaseYear = new Date(t.releaseDate).getFullYear();
            return releaseYear >= decadeRange.start && releaseYear <= decadeRange.end;
         });
      }

      if (validTracks.length === 0) continue;
      
      let selectedTrack: ItunesTrack | null = null;
      let selectedKey = "";

      for (const t of validTracks) {
          const key = generateSongKey(t.artistName, t.trackName);
          if (playedItems.includes(key)) {
              if (isSpecificRequest) {
                  selectedTrack = null; 
                  break; 
              }
              continue; 
          }
          selectedTrack = t;
          selectedKey = key;
          break; 
      }

      if (!selectedTrack) continue;

      let releaseYear = "";
      if (selectedTrack.releaseDate) {
          const dateObj = new Date(selectedTrack.releaseDate);
          if (!isNaN(dateObj.getTime())) {
              releaseYear = dateObj.getFullYear().toString();
          }
      }

      let titleDisplay = "";
      let artistDisplay = "";

      if (isMovieCat) {
        titleDisplay = manualTitle || selectedTrack.collectionName || selectedTrack.trackName || "Unknown Movie";
        artistDisplay = ""; 
      } else {
        titleDisplay = manualTitle || selectedTrack.trackName || "Unknown Title";
        artistDisplay = selectedTrack.artistName || "Unknown Artist";
      }

      const uniqueId = `music-${selectedTrack.trackId}-${Math.random().toString(36).substr(2, 9)}`;

      const newQuestion: ProcessedQuestion = {
        id: uniqueId,
        category: cat.name,
        categoryId: cat.id,
        type: 'music',
        difficulty: 'honor-system',
        question: isMovieCat ? "Guess the Soundtrack!" : "Listen & Guess!",
        correct_answer: "Honor System",
        incorrect_answers: [],
        all_answers: [],
        isAnswered: false,
        pointValue: POINT_VALUE,
        mediaType: 'audio',
        audioUrl: selectedTrack.previewUrl,
        timerDuration: TIMER_DURATION,
        answerReveal: {
          artist: artistDisplay,
          title: titleDisplay,
          year: isMovieCat ? undefined : releaseYear
        }
      };

      questions.push(newQuestion);
      savePlayedItem(selectedKey);

    } catch (e) {
      console.warn("Fetch failed for item:", item);
    }
  }

  return questions;
};

// --- Logic B1: Standard (OpenTDB) ---
const fetchStandardQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const categoryId = getOpenTDBCategoryId(cat.id);
  const playedItems = getPlayedItems();
  const token = await getOpenTdbToken();
  
  let url = `${OPENTDB_API_URL}?amount=20&type=multiple&category=${categoryId}`;
  if (token) url += `&token=${token}`;

  try {
    let res: Response | null = null;
    for(let attempt = 0; attempt < 3; attempt++) {
        try {
            res = await fetch(url);
            if (res.status === 429) {
                await wait(2000 * (attempt + 1));
                continue;
            }
            if (res.ok) break;
        } catch(e) {
            await wait(1000);
        }
    }

    if (!res || !res.ok) {
        console.warn(`Failed to fetch OpenTDB cat ${categoryId} after retries`);
        return [];
    }
    
    const data = await res.json();
    if (data.response_code === 4) {
       console.warn("Alla frågor slut för denna token! Återställer token...");
       openTdbToken = null; 
       return []; 
    }

    let rawResults: any[] = data.results || [];
    const freshQuestions = rawResults.filter(q => {
        const tempId = `otdb-${q.question.substring(0, 10)}`; 
        return !playedItems.includes(tempId);
    });

    const pool = freshQuestions.length >= 5 ? freshQuestions : rawResults;
    if (pool.length === 0) return [];

    const easy = pool.filter((q: any) => q.difficulty === 'easy');
    const medium = pool.filter((q: any) => q.difficulty === 'medium');
    const hard = pool.filter((q: any) => q.difficulty === 'hard');

    const selectedQuestions: ProcessedQuestion[] = [];
    const pointValues = [200, 400, 600, 800, 1000];
    const slots = ['easy', 'easy', 'medium', 'medium', 'hard'];

    for (let i = 0; i < 5; i++) {
        const targetDiff = slots[i];
        let qRaw: any;
        if (targetDiff === 'easy') qRaw = easy.pop();
        else if (targetDiff === 'medium') qRaw = medium.pop();
        else qRaw = hard.pop();

        if (!qRaw) {
             if (targetDiff === 'hard') qRaw = medium.pop() || easy.pop();
             else if (targetDiff === 'medium') qRaw = hard.pop() || easy.pop();
             else qRaw = medium.pop() || hard.pop();
        }
        if (!qRaw) qRaw = pool[i % pool.length];

        if (qRaw) {
            const questionText = decodeHtml(qRaw.question);
            const correctAnswer = decodeHtml(qRaw.correct_answer);
            const incorrectAnswers = qRaw.incorrect_answers.map((a: string) => decodeHtml(a));
            
            const uniqueId = `otdb-${questionText.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
            const allAnswers = shuffle([correctAnswer, ...incorrectAnswers]);

            selectedQuestions.push({
                id: uniqueId,
                category: cat.name,
                categoryId: cat.id,
                type: 'text',
                difficulty: qRaw.difficulty,
                question: questionText,
                correct_answer: correctAnswer,
                incorrect_answers: incorrectAnswers,
                all_answers: allAnswers,
                isAnswered: false,
                pointValue: pointValues[i],
                mediaType: 'text',
                timerDuration: 30
            });
            savePlayedItem(uniqueId);
        }
    }
    return selectedQuestions.length === 5 ? selectedQuestions : [];

  } catch (e) {
    console.error("OpenTDB API Error", e);
    return [];
  }
};

// --- Logic B2: The Trivia API (Modern, Bigger) ---
const fetchTheTriviaApiQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
    // Mappa ditt ID till deras "slugs"
    // 'triv_history' -> 'history'
    const categorySlug = cat.id.replace('triv_', '');
    const playedItems = getPlayedItems();
    
    // Vi hämtar 15 frågor för att vara säkra på att få 5 unika och bra
    const url = `${TRIVIA_API_URL}?limit=15&categories=${categorySlug}`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("API call failed");
        
        const data = await res.json();
        
        const freshQuestions = data.filter((q: any) => !playedItems.includes(`triv-${q.id}`));
        const pool = freshQuestions.length >= 5 ? freshQuestions : data;
        
        if (pool.length === 0) return [];

        const easy = pool.filter((q: any) => q.difficulty === 'easy');
        const medium = pool.filter((q: any) => q.difficulty === 'medium');
        const hard = pool.filter((q: any) => q.difficulty === 'hard');
        
        const selectedQuestions: ProcessedQuestion[] = [];
        const pointValues = [200, 400, 600, 800, 1000];
        const slots = ['easy', 'easy', 'medium', 'medium', 'hard'];

        for (let i = 0; i < 5; i++) {
            const targetDiff = slots[i];
            let qRaw: any;
            
            if (targetDiff === 'easy') qRaw = easy.pop();
            else if (targetDiff === 'medium') qRaw = medium.pop();
            else qRaw = hard.pop();
            
            // Backfill
            if (!qRaw) qRaw = medium.pop() || easy.pop() || hard.pop() || pool[i % pool.length];
            
            if (qRaw) {
                 const uniqueId = `triv-${qRaw.id}`;
                 const allAnswers = shuffle([...qRaw.incorrectAnswers, qRaw.correctAnswer]);
                 
                 selectedQuestions.push({
                    id: uniqueId,
                    category: cat.name,
                    categoryId: cat.id,
                    type: 'text',
                    difficulty: qRaw.difficulty,
                    question: qRaw.question.text, // Trivia API structure
                    correct_answer: qRaw.correctAnswer,
                    incorrect_answers: qRaw.incorrectAnswers,
                    all_answers: allAnswers,
                    isAnswered: false,
                    pointValue: pointValues[i],
                    mediaType: 'text',
                    timerDuration: 30
                 });
                 savePlayedItem(uniqueId);
            }
        }
        
        return selectedQuestions.length === 5 ? selectedQuestions : [];
        
    } catch (e) {
        console.warn("The Trivia API failed", e);
        return [];
    }
};

// --- Logic C: Geography Hybrid ---
const fetchGeoQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const pointValues = [200, 400, 600, 800, 1000];
  const BANNED_COUNTRIES = [
    "Afghanistan", "Saudi Arabia", "Iraq", "Iran", "Brunei", 
    "El Salvador", "Guatemala", "Nicaragua", "Paraguay", "Dominican Republic"
  ];
  const EUROPEAN_MAP_NAMES = [
    "Sweden", "Norway", "Finland", "Denmark", "Iceland", "France", "Germany", 
    "Spain", "Italy", "England", "Ukraine", "Poland", "Netherlands", "Belgium", 
    "Greece", "Portugal", "Czech Republic", "Hungary", "Austria", "Switzerland", 
    "Romania", "Ireland", "Bulgaria", "Serbia", "Slovakia", "Croatia", "Belarus", "Lithuania"
  ];

  if (cat.id === 'geo_maps') {
    const questions: ProcessedQuestion[] = [];
    const pool = [...GEO_MAPS_DATA];
    const easyBucket = pool.filter(c => EUROPEAN_MAP_NAMES.includes(c.name) || c.population > 25_000_000);
    const mediumBucket = pool.filter(c => !easyBucket.includes(c) && (c.population > 6_000_000));
    const hardBucket = pool.filter(c => !easyBucket.includes(c) && !mediumBucket.includes(c));

    const selectionOrder = [
      shuffle(easyBucket), shuffle(easyBucket), 
      shuffle(mediumBucket), shuffle(mediumBucket), 
      shuffle(hardBucket)
    ];

    for (let i = 0; i < 5; i++) {
        let targetCountry;
        if (selectionOrder[i].length > 0) targetCountry = selectionOrder[i].pop();
        if (!targetCountry) targetCountry = shuffle(pool).find(c => !questions.some(q => q.correct_answer === c.name));

        if (targetCountry) {
            const potentialDistractors = pool.filter(c => c.name !== targetCountry!.name);
            const distractors = shuffle(potentialDistractors).slice(0, 3).map(c => c.name);
            const allAnswers = shuffle([targetCountry.name, ...distractors]);
            const uniqueId = `map-${targetCountry.name}`;

            questions.push({
                id: uniqueId,
                category: cat.name,
                categoryId: cat.id,
                type: 'multiple', 
                difficulty: i < 2 ? 'easy' : (i < 4 ? 'medium' : 'hard'),
                question: `Find this country on the map: ${targetCountry.name}`,
                correct_answer: targetCountry.name,
                incorrect_answers: distractors,
                all_answers: allAnswers,
                isAnswered: false,
                pointValue: pointValues[i],
                mediaType: 'image',
                imageUrl: '',
                timerDuration: 30
            });
            savePlayedItem(uniqueId);
        }
    }
    return questions.length === 5 ? questions : [];
  }

  const isFlags = cat.id === 'geo_flags';
  try {
    const res = await fetch(REST_COUNTRIES_URL);
    if (!res.ok) return [];

    const allCountries: Country[] = await res.json();
    const validCountries = allCountries.filter(c => 
      c.name?.common && c.flags?.svg && c.capital?.[0] &&
      c.independent === true && c.population >= 100000 &&
      !BANNED_COUNTRIES.includes(c.name.common)
    );

    if (validCountries.length < 10) return [];
    const easyBucket = validCountries.filter(c => {
       const isEurope = c.region === 'Europe';
       const isNorthAmerica = c.subregion === 'North America';
       const isAusNZ = c.name.common === 'Australia' || c.name.common === 'New Zealand';
       const isLarge = c.population > 20_000_000;
       return isEurope || isNorthAmerica || isAusNZ || isLarge;
    });

    const mediumBucket = validCountries.filter(c => {
       if (easyBucket.includes(c)) return false;
       const isSouthAmerica = c.subregion === 'South America';
       const isMediumSize = c.population > 5_000_000;
       return isSouthAmerica || isMediumSize;
    });

    const hardBucket = validCountries.filter(c => !easyBucket.includes(c) && !mediumBucket.includes(c));
    const questions: ProcessedQuestion[] = [];
    const selectionOrder = [
      shuffle(easyBucket), shuffle(easyBucket),
      shuffle(mediumBucket), shuffle(mediumBucket),
      shuffle(hardBucket)
    ];

    for (let i = 0; i < 5; i++) {
       let country: Country | undefined;
       while(selectionOrder[i].length > 0) {
         const candidate = selectionOrder[i].pop();
         if (candidate) {
            const tempId = `geo-${candidate.name.common}`;
            if (!playedItems.includes(tempId) && !questions.some(q => q.id === tempId)) {
               country = candidate;
               break;
            }
         }
       }
       if (!country) country = shuffle(validCountries).find(c => !questions.some(q => q.answerReveal?.title.includes(c.name.common)));
       if (country) {
          const qText = isFlags ? "Identify this Flag!" : "Name the Capital!";
          const countryName = country.name.common;
          const capitalName = country.capital[0];
          const uniqueId = `geo-${countryName}`;

          questions.push({
            id: uniqueId,
            category: cat.name,
            categoryId: cat.id,
            type: 'honor-system',
            difficulty: i < 2 ? 'easy' : (i < 4 ? 'medium' : 'hard'),
            question: qText,
            correct_answer: 'Honor System',
            incorrect_answers: [],
            all_answers: [],
            isAnswered: false,
            pointValue: pointValues[i],
            mediaType: 'image',
            imageUrl: country.flags.svg,
            infoText: isFlags ? undefined : countryName,
            timerDuration: 30,
            answerReveal: {
              title: isFlags ? countryName : capitalName,
              artist: isFlags ? "Country" : "Capital" 
            }
          });
          savePlayedItem(uniqueId);
       }
    }
    return questions.length === 5 ? questions : [];

  } catch (e) {
    console.warn("Geo API failed", e);
    return [];
  }
};

// --- Logic D: Movie Posters ---
const fetchMoviePosterQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    console.error("VITE_TMDB_API_KEY is missing!");
    return [];
  }

  const playedItems = getPlayedItems();
  const questions: ProcessedQuestion[] = [];
  const pointValues = [200, 400, 600, 800, 1000];
  const pages = shuffle(Array.from({length: 20}, (_, i) => i + 1)).slice(0, 5);
  const candidates: any[] = [];
  
  try {
     for (const page of pages) {
        const params = new URLSearchParams({
          api_key: apiKey,
          language: 'en-US',
          sort_by: 'vote_count.desc',
          'primary_release_date.gte': '1970-01-01',
          'vote_count.gte': '1000',
          include_adult: 'false',
          include_video: 'false',
          page: page.toString()
        });
        const res = await fetch(`${TMDB_API_URL}?${params.toString()}`);
        const data = await res.json();
        if (data.results) candidates.push(...data.results);
     }
  } catch (e) {
     console.error("TMDB Fetch Error", e);
     return [];
  }

  const validCandidates = candidates.filter(m => m.release_date && m.poster_path);
  const freshCandidates = validCandidates.filter(m => !playedItems.includes(`mov-${m.id}`));
  const pool = freshCandidates.length >= 5 ? freshCandidates : validCandidates;
  const selectedMovies = shuffle(pool).slice(0, 5);

  for (let i = 0; i < selectedMovies.length; i++) {
    const movie = selectedMovies[i];
    const uniqueId = `mov-${movie.id}`;
    const realYear = parseInt(movie.release_date.split('-')[0]);
    const answers = new Set<string>();
    answers.add(realYear.toString());
    while(answers.size < 4) {
      const offset = Math.floor(Math.random() * 11) - 5; 
      const dYear = realYear + offset;
      if (dYear > 1900 && dYear <= new Date().getFullYear() + 1) answers.add(dYear.toString());
    }
    questions.push({
      id: uniqueId,
      category: cat.name,
      categoryId: cat.id,
      type: 'multiple',
      difficulty: 'medium',
      question: "Guess the Release Year!",
      correct_answer: realYear.toString(),
      incorrect_answers: [], 
      all_answers: shuffle(Array.from(answers)),
      isAnswered: false,
      pointValue: pointValues[i],
      mediaType: 'image',
      imageUrl: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      infoText: movie.title, 
      timerDuration: 30
    });
    savePlayedItem(uniqueId);
  }
  return questions;
};

// --- Logic E: Football Career ---
const fetchCareerQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const questions: ProcessedQuestion[] = [];
  const pointValues = [200, 400, 600, 800, 1000];
  
  for (let level = 1; level <= 5; level++) {
    const candidates = FOOTBALL_CAREERS.filter(p => p.difficulty === level);
    const shuffled = shuffle(candidates);
    let selectedPlayer = shuffled.find(p => !playedItems.includes(`fc-${p.player}`));
    if (!selectedPlayer) selectedPlayer = shuffled[0];
    if (!selectedPlayer) continue;

    const uniqueId = `fc-${selectedPlayer.player}`;
    const yearsActive = (selectedPlayer as any).years || ""; 

    questions.push({
      id: uniqueId,
      category: cat.name,
      categoryId: cat.id,
      type: 'honor-system',
      difficulty: level <= 2 ? 'easy' : (level <= 4 ? 'medium' : 'hard'),
      question: yearsActive ? `Who is this player? (${yearsActive})` : "Who is this player?",
      correct_answer: "Honor System",
      incorrect_answers: [],
      all_answers: [],
      isAnswered: false,
      pointValue: pointValues[level - 1],
      mediaType: 'text_sequence',
      clubList: selectedPlayer.clubs,
      timerDuration: 30,
      answerReveal: {
        title: selectedPlayer.player,
        artist: "Career Path"
      }
    });
    savePlayedItem(uniqueId);
  }
  return questions;
};

export const fetchGameData = async (selectedCategories: TriviaCategory[]): Promise<CategoryColumn[]> => {
  const columns: CategoryColumn[] = [];

  for (const cat of selectedCategories) {
    // Determine wait time
    const isOpenTDB = cat.id.startsWith('otdb_');
    const delayTime = isOpenTDB ? 6000 : 1000; 

    if (columns.length > 0) {
      console.log(`⏳ Väntar ${delayTime}ms...`);
      await wait(delayTime);
    }
    
    let questions: ProcessedQuestion[] = [];

    try {
      if (cat.id.startsWith('music_')) {
        let list: MusicItem[] = [];
        switch (cat.id) {
          case 'music_rock': list = ARTISTS_ROCK; break;
          case 'music_80s': list = ARTISTS_80S; break;
          case 'music_90s': list = ARTISTS_90S; break;
          case 'music_2000s': list = ARTISTS_2000S; break;
          case 'music_2010s': list = ARTISTS_2010S; break;
          case 'music_hiphop': list = ARTISTS_HIPHOP; break;
          case 'music_movies': list = MOVIE_THEMES; break;
          default: list = ARTISTS_2010S;
        }
        questions = await fetchFromMixedList(list, cat);

      } else if (cat.id.startsWith('geo_')) {
        questions = await fetchGeoQuestions(cat);

      } else if (cat.id === 'mov_posters') {
        questions = await fetchMoviePosterQuestions(cat);

      } else if (cat.id === 'football_career') {
        questions = await fetchCareerQuestions(cat);

      } else if (cat.id.startsWith('triv_')) {
        // NY HANTERING FÖR THE TRIVIA API
        questions = await fetchTheTriviaApiQuestions(cat);

      } else {
        // Default to OpenTDB (otdb_...)
        questions = await fetchStandardQuestions(cat);
      }
    } catch (err) {
      console.error(`Fel vid hämtning av ${cat.name}:`, err);
    }

    if (questions.length === 5) {
      columns.push({
        title: cat.name,
        questions: questions
      });
    }
  }

  return columns;
};