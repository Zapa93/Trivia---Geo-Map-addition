import { CategoryColumn, ProcessedQuestion, TriviaCategory, ApiQuestion, ItunesTrack } from '../types';
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
// Updated URL to include 'independent' field
const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,flags,capital,population,independent';
const TMDB_API_URL = 'https://api.themoviedb.org/3/discover/movie';

const PLAYED_ITEMS_KEY = 'trivia_played_items_v2';

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

// Local Fisher-Yates Shuffle
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
    'otdb_film': 11,
    'otdb_music': 12,
    'otdb_tv': 14,
    'otdb_videogames': 15,
    'otdb_cartoons': 32,
    'otdb_science': 17,
    'otdb_computers': 18,
    'otdb_math': 19,
    'otdb_gadgets': 30,
    'otdb_mythology': 20,
    'otdb_sports': 21,
    'otdb_geography': 22,
    'otdb_history': 23,
    'otdb_politics': 24,
    'otdb_art': 25,
    'otdb_celebs': 26,
    'otdb_animals': 27,
    'otdb_vehicles': 28
  };
  return map[id] || 9;
};

// Helper to determine year range for music categories
const getDecadeRange = (catId: string): { start: number, end: number } | null => {
  switch (catId) {
    case 'music_80s': return { start: 1980, end: 1989 };
    case 'music_90s': return { start: 1990, end: 1999 };
    case 'music_2000s': return { start: 2000, end: 2009 };
    case 'music_2010s': return { start: 2010, end: 2019 };
    // Explicitly return null for other categories to avoid confusion
    default: return null;
  }
};

// Normalization Helper for Song Identity
const generateSongKey = (artist: string, title: string): string => {
  const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, '');
  return `song_${normalize(artist)}_${normalize(title)}`;
};

// Updated Type to support string, ID objects, Title/Artist objects, and Artist/Limit objects
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
  independent: boolean; // Added independent field
}

// --- Logic A: Music (iTunes) ---
const fetchFromMixedList = async (list: MusicItem[], cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const decadeRange = getDecadeRange(cat.id);
  
  const shuffledList = shuffle(list);
  const candidates = shuffledList.slice(0, 30); // Grab more candidates to account for filtering
  
  const questions: ProcessedQuestion[] = [];
  const duplicatesBuffer: ProcessedQuestion[] = []; 
  
  const isMovieCat = cat.id === 'music_movies';

  // Fixed 400 points for all music questions per request
  const POINT_VALUE = 400;
  const TIMER_DURATION = isMovieCat ? 25 : 15;

  for (const item of candidates) {
    if (questions.length >= 5) break;

    let url = '';
    let manualTitle: string | null = null;
    let isIdLookup = false;

    // Detect if this is a Specific Song Request
    // ONLY true if the item has a 'title' property.
    // { artist: 'X', limit: 10 } is considered a generic search, so we continue if played.
    const isSpecificRequest = typeof item !== 'string' && 'title' in item;

    // Determine URL based on Item Type
    if (typeof item === 'string') {
        const term = encodeURIComponent(item);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=25&country=US`;
    } else if ('id' in item) {
        // ID Based Lookup (Movie Themes)
        isIdLookup = true;
        url = `${ITUNES_LOOKUP_URL}?id=${item.id}&country=US`;
        manualTitle = item.title;
    } else if ('title' in item) {
        // Specific Song Query ({ title, artist })
        const query = `${item.title} ${item.artist}`;
        const term = encodeURIComponent(query);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=5&country=US`;
        manualTitle = item.title;
    } else {
        // Artist with Limit ({ artist, limit })
        const limit = item.limit || 25;
        const term = encodeURIComponent(item.artist);
        url = `${ITUNES_API_URL}?term=${term}&entity=song&limit=${limit}&country=US`;
        manualTitle = null; // Let API decide title
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      let validTracks: ItunesTrack[] = [];

      if (isIdLookup) {
          // For Lookup, we trust the ID, just check for previewUrl
          validTracks = (data.results || []).filter((t: any) => t.previewUrl);
      } else {
          // For Search, filter aggressively
          validTracks = (data.results || []).filter((t: any) => t.previewUrl && t.kind === 'song');

          // --- STRING SEARCH (Generic Artist) ---
          if (typeof item === 'string') {
              const searchArtist = item.toLowerCase();
              validTracks = validTracks.filter((t: ItunesTrack) => {
                 const artistLower = (t.artistName || "").toLowerCase();
                 const trackLower = (t.trackName || "").toLowerCase();
                 const collectionLower = (t.collectionName || "").toLowerCase();

                 // Check if artist name matches the search term
                 if (!artistLower.includes(searchArtist)) return false;

                 // Remove garbage/unwanted terms (covers, karaoke, etc.)
                 const forbiddenTerms = ["tribute", "cover", "karaoke"];
                 if (forbiddenTerms.some(term => trackLower.includes(term))) return false;
                 if (forbiddenTerms.some(term => collectionLower.includes(term))) return false;
                 if (forbiddenTerms.some(term => artistLower.includes(term))) return false;

                 return true;
              });
          }

          // --- OBJECT SEARCH (Specific Song OR Artist+Limit) ---
          if (typeof item !== 'string' && 'artist' in item) {
              const requiredArtist = item.artist.toLowerCase();
              validTracks = validTracks.filter((t: ItunesTrack) => {
                  const artistLower = (t.artistName || "").toLowerCase();
                  
                  // 1. Strict Artist Check (Required for both {title, artist} and {artist, limit})
                  if (!artistLower.includes(requiredArtist)) return false;

                  // 2. Forbidden Terms Check
                  // Apply ONLY if it's NOT a specific title request (i.e. it is { artist, limit })
                  // We assume specific title requests provided by us are safe, but generic artist pulls need filtering.
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

      // --- STRICT DECADE FILTERING ---
      if (decadeRange && !isIdLookup) {
         validTracks = validTracks.filter(t => {
            if (!t.releaseDate) return false;
            const releaseYear = new Date(t.releaseDate).getFullYear();
            return releaseYear >= decadeRange.start && releaseYear <= decadeRange.end;
         });
      }

      // If filtering removed all tracks, skip.
      if (validTracks.length === 0) continue;

      // --- PLAYED LOGIC ---
      let track: ItunesTrack | null = null;
      let songKey = "";
      let isDuplicate = true; // Assume true initially

      for (const t of validTracks) {
          const key = generateSongKey(t.artistName, t.trackName);
          
          if (playedItems.includes(key)) {
              // LOGIC BRANCH:
              // If we requested a SPECIFIC song (e.g. "Logic - 1-800") and it is played,
              // we must ABORT this entire item.
              // If it's a GENERIC artist search (String or {artist, limit}), we continue to finding the next track.
              if (isSpecificRequest) {
                  track = null; // Ensure we don't pick anything
                  break; // Break inner loop, will trigger 'continue' in outer loop
              }
              
              continue; // Skip this track, check next one in validTracks
          }

          // Found a valid, unplayed track
          track = t;
          songKey = key;
          isDuplicate = false;
          break; // Stop searching inner loop
      }

      // If we didn't find a track (either because all were played, or we aborted), skip to next candidate
      if (!track) continue;

      // Extract Year
      let releaseYear = "";
      if (track.releaseDate) {
          const dateObj = new Date(track.releaseDate);
          if (!isNaN(dateObj.getTime())) {
              releaseYear = dateObj.getFullYear().toString();
          }
      }

      let titleDisplay = "";
      let artistDisplay = "";

      if (isMovieCat) {
        titleDisplay = manualTitle || track.collectionName || track.trackName || "Unknown Movie";
        artistDisplay = ""; 
      } else {
        titleDisplay = manualTitle || track.trackName || "Unknown Title";
        artistDisplay = track.artistName || "Unknown Artist";
      }

      const uniqueId = `music-${track.trackId}`; // Keep DOM ID simple, but we save songKey to history

      const newQuestion: ProcessedQuestion = {
        id: uniqueId,
        category: cat.name,
        categoryId: cat.id, // Ensure ID is passed
        type: 'music',
        difficulty: 'honor-system',
        question: isMovieCat ? "Guess the Soundtrack!" : "Listen & Guess!",
        correct_answer: "Honor System",
        incorrect_answers: [],
        all_answers: [],
        isAnswered: false,
        pointValue: POINT_VALUE, // Fixed at 400
        mediaType: 'audio',
        audioUrl: track.previewUrl,
        timerDuration: TIMER_DURATION,
        answerReveal: {
          artist: artistDisplay,
          title: titleDisplay,
          // Hide year for Soundtracks
          year: isMovieCat ? undefined : releaseYear
        }
      };

      if (isDuplicate) {
        duplicatesBuffer.push(newQuestion);
        continue;
      }

      questions.push(newQuestion);
      savePlayedItem(songKey); // Save the IDENTITY, not just the ID

    } catch (e) {
      console.warn("Fetch failed for item:", item);
    }
  }

  while (questions.length < 5 && duplicatesBuffer.length > 0) {
     const fallback = duplicatesBuffer.pop();
     if (fallback) {
        fallback.id = `music-dup-${Math.random()}`; 
        fallback.pointValue = POINT_VALUE; // Ensure fallback gets correct points
        questions.push(fallback);
     }
  }

  return questions;
};

// --- Logic B: Standard (OpenTDB) ---
const fetchStandardQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const categoryId = getOpenTDBCategoryId(cat.id);
  // Fetch more to sort by difficulty
  const url = `${OPENTDB_API_URL}?amount=20&type=multiple&category=${categoryId}`;
  const playedItems = getPlayedItems();

  try {
    // Retry Logic for Rate Limits (429)
    let res: Response | null = null;
    for(let attempt = 0; attempt < 3; attempt++) {
        try {
            res = await fetch(url);
            if (res.status === 429) {
                // Wait longer for each retry
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
    let rawResults: any[] = data.results || [];

    // Filter duplicates using question text as ID proxy (OpenTDB doesn't return stable IDs)
    const freshQuestions = rawResults.filter(q => {
        const tempId = `otdb-${q.question.substring(0, 10)}`; // Weak hash
        return !playedItems.includes(tempId);
    });

    const pool = freshQuestions.length >= 5 ? freshQuestions : rawResults;
    if (pool.length === 0) return []; // No questions available at all

    // Sort by difficulty
    const easy = pool.filter((q: any) => q.difficulty === 'easy');
    const medium = pool.filter((q: any) => q.difficulty === 'medium');
    const hard = pool.filter((q: any) => q.difficulty === 'hard');

    const selectedQuestions: ProcessedQuestion[] = [];
    const pointValues = [200, 400, 600, 800, 1000];
    
    // Grid Target: Easy, Easy, Medium, Medium, Hard
    const slots = ['easy', 'easy', 'medium', 'medium', 'hard'];

    for (let i = 0; i < 5; i++) {
        const targetDiff = slots[i];
        let qRaw: any;

        if (targetDiff === 'easy') qRaw = easy.pop();
        else if (targetDiff === 'medium') qRaw = medium.pop();
        else qRaw = hard.pop();

        // Backfill
        if (!qRaw) {
             if (targetDiff === 'hard') qRaw = medium.pop() || easy.pop();
             else if (targetDiff === 'medium') qRaw = hard.pop() || easy.pop();
             else qRaw = medium.pop() || hard.pop();
        }

        // Last resort: Cyclic fallback if we ran out of unique questions in buckets
        if (!qRaw) {
            qRaw = pool[i % pool.length];
        }

        if (qRaw) {
            const questionText = decodeHtml(qRaw.question);
            const correctAnswer = decodeHtml(qRaw.correct_answer);
            const incorrectAnswers = qRaw.incorrect_answers.map((a: string) => decodeHtml(a));
            
            // Generate unique ID even if reused (append index)
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
                timerDuration: 30 // Increased to 30s
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

// --- Logic C: Geography Hybrid (Local Maps + Rest Countries API) ---
const fetchGeoQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const pointValues = [200, 400, 600, 800, 1000];

  // --- BRANCH 1: Local Maps (Interactive Map) ---
  if (cat.id === 'geo_maps') {
    const questions: ProcessedQuestion[] = [];
    const pool = [...GEO_MAPS_DATA];
    
    // Create buckets based on population
    const easyBucket = pool.filter(c => c.population > 20_000_000);
    const mediumBucket = pool.filter(c => c.population > 5_000_000 && c.population <= 20_000_000);
    const hardBucket = pool.filter(c => c.population <= 5_000_000);

    const selectionOrder = [
      shuffle(easyBucket),
      shuffle(easyBucket),
      shuffle(mediumBucket),
      shuffle(mediumBucket),
      shuffle(hardBucket)
    ];

    for (let i = 0; i < 5; i++) {
        let targetCountry;

        // Try to pick from bucket
        if (selectionOrder[i].length > 0) {
            targetCountry = selectionOrder[i].pop();
        }
        
        // Fallback: Pick any from pool not used
        if (!targetCountry) {
            const unused = shuffle(pool).find(c => !questions.some(q => q.correct_answer === c.name));
            targetCountry = unused || pool[i % pool.length]; // Absolute fallback
        }

        if (targetCountry) {
            // Select 3 unique distractors (excluding target)
            const potentialDistractors = pool.filter(c => c.name !== targetCountry!.name);
            const distractors = shuffle(potentialDistractors).slice(0, 3).map(c => c.name);

            const allAnswers = shuffle([targetCountry.name, ...distractors]);
            const uniqueId = `map-${targetCountry.name}`;

            questions.push({
                id: uniqueId,
                category: cat.name,
                categoryId: cat.id,
                type: 'multiple', // Treated as multiple for logic, but UI handles Map click
                difficulty: i < 2 ? 'easy' : (i < 4 ? 'medium' : 'hard'),
                question: `Find this country on the map: ${targetCountry.name}`,
                correct_answer: targetCountry.name,
                incorrect_answers: distractors,
                all_answers: allAnswers,
                isAnswered: false,
                pointValue: pointValues[i],
                mediaType: 'image', // UI will hijack this based on categoryId to show map
                imageUrl: '', // No image needed, map component renders
                timerDuration: 30
            });
            savePlayedItem(uniqueId);
        }
    }
    return questions.length === 5 ? questions : [];
  }

  // --- BRANCH 2: API (Flags & Capitals) ---
  const isFlags = cat.id === 'geo_flags';
  
  try {
    const res = await fetch(REST_COUNTRIES_URL);
    if (!res.ok) return [];

    const allCountries: Country[] = await res.json();
    
    // Strict filtering: Independent only, Population >= 250k
    const validCountries = allCountries.filter(c => 
      c.name?.common && 
      c.flags?.svg && 
      c.population && 
      c.capital?.[0] &&
      c.independent === true && 
      c.population >= 250000 
    );

    if (validCountries.length < 10) return [];

    // Bucket Logic
    const easyBucket = validCountries.filter(c => c.population > 20_000_000);
    const mediumBucket = validCountries.filter(c => c.population > 5_000_000 && c.population <= 20_000_000);
    const hardBucket = validCountries.filter(c => c.population <= 5_000_000);

    const questions: ProcessedQuestion[] = [];
    
    // Slots: Easy, Easy, Medium, Medium, Hard
    const selectionOrder = [
      shuffle(easyBucket),
      shuffle(easyBucket),
      shuffle(mediumBucket),
      shuffle(mediumBucket),
      shuffle(hardBucket)
    ];

    for (let i = 0; i < 5; i++) {
       let country: Country | undefined;
       
       // Try to find an unplayed country in the bucket
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
       
       // Fallback: Pick any valid if we ran out of fresh ones
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
            timerDuration: 30, // Increased to 30s
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

// --- Logic D: Movie Posters (TMDB) ---
const fetchMoviePosterQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    console.error("VITE_TMDB_API_KEY is missing!");
    return [];
  }

  const playedItems = getPlayedItems();
  const questions: ProcessedQuestion[] = [];
  const pointValues = [200, 400, 600, 800, 1000];

  // Randomize pages to get different movies (Pages 1-20 for popularity sort)
  // sort_by=vote_count.desc ensures we get blockbusters
  const pages = shuffle(Array.from({length: 20}, (_, i) => i + 1)).slice(0, 5);
  
  // We need to fetch multiple pages potentially to find 5 fresh movies
  const candidates: any[] = [];
  
  try {
     for (const page of pages) {
        // Construct URL with Discover parameters for Blockbusters
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
        if (data.results) {
            candidates.push(...data.results);
        }
     }
  } catch (e) {
     console.error("TMDB Fetch Error", e);
     return [];
  }

  // Filter valid candidates (must have release_date and poster)
  const validCandidates = candidates.filter(m => m.release_date && m.poster_path);
  const freshCandidates = validCandidates.filter(m => !playedItems.includes(`mov-${m.id}`));
  
  const pool = freshCandidates.length >= 5 ? freshCandidates : validCandidates;
  const selectedMovies = shuffle(pool).slice(0, 5);

  for (let i = 0; i < selectedMovies.length; i++) {
    const movie = selectedMovies[i];
    const uniqueId = `mov-${movie.id}`;
    const realYear = parseInt(movie.release_date.split('-')[0]);
    
    // Generate distractors
    const answers = new Set<string>();
    answers.add(realYear.toString());
    
    while(answers.size < 4) {
      const offset = Math.floor(Math.random() * 11) - 5; // -5 to +5
      const dYear = realYear + offset;
      if (dYear > 1900 && dYear <= new Date().getFullYear() + 1) {
          answers.add(dYear.toString());
      }
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
      all_answers: shuffle(Array.from(answers)), // STRICT SHUFFLE
      isAnswered: false,
      pointValue: pointValues[i],
      mediaType: 'image',
      imageUrl: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      infoText: movie.title, 
      timerDuration: 30 // Increased to 30s
    });
    savePlayedItem(uniqueId);
  }

  return questions;
};

// --- Logic E: Football Career Path (TEXT ONLY) ---
const fetchCareerQuestions = async (cat: TriviaCategory): Promise<ProcessedQuestion[]> => {
  const playedItems = getPlayedItems();
  const questions: ProcessedQuestion[] = [];
  const pointValues = [200, 400, 600, 800, 1000];
  
  // Difficulty levels 1 to 5 (mapped to grid rows)
  for (let level = 1; level <= 5; level++) {
    // Filter candidates for this level
    const candidates = FOOTBALL_CAREERS.filter(p => p.difficulty === level);
    
    // Find a unique player that hasn't been played
    const shuffled = shuffle(candidates);
    let selectedPlayer = shuffled.find(p => !playedItems.includes(`fc-${p.player}`));
    
    // Fallback if all players at this level played
    if (!selectedPlayer) selectedPlayer = shuffled[0];

    if (!selectedPlayer) continue;

    const uniqueId = `fc-${selectedPlayer.player}`;

    questions.push({
      id: uniqueId,
      category: cat.name,
      categoryId: cat.id,
      type: 'honor-system',
      difficulty: level <= 2 ? 'easy' : (level <= 4 ? 'medium' : 'hard'),
      question: "Who is this player?",
      correct_answer: "Honor System",
      incorrect_answers: [],
      all_answers: [],
      isAnswered: false,
      pointValue: pointValues[level - 1],
      mediaType: 'text_sequence',
      clubList: selectedPlayer.clubs, // Pass raw strings
      timerDuration: 30, // Increased to 30s
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
    await wait(150); // Reduced delay to 150ms as requested
    
    let questions: ProcessedQuestion[] = [];

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
        default: 
          console.warn(`Category ID "${cat.id}" not matched in music switch. Falling back to ARTISTS_2010S. This may cause decade mismatch.`);
          list = ARTISTS_2010S;
      }
      
      questions = await fetchFromMixedList(list, cat);
    } else if (cat.id.startsWith('geo_')) {
      questions = await fetchGeoQuestions(cat);
    } else if (cat.id === 'mov_posters') {
      questions = await fetchMoviePosterQuestions(cat);
    } else if (cat.id === 'football_career') {
      questions = await fetchCareerQuestions(cat);
    } else {
      // Default to OpenTDB for all standard text categories
      questions = await fetchStandardQuestions(cat);
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