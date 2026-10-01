import crypto from "crypto";
import type { ConceptContext, TriadCard, TriadDraw, TriadMode, TriadAxis } from "./concepts";

const WHO: TriadCard[] = [
  { id: "who-businessman", axis: "who", label: "Businessman", text: "A very serious businessman", tags: ["adult", "business", "city", "status"], source: "curated" },
  { id: "who-retired-astronomer", axis: "who", label: "Retired Astronomer", text: "A retired astronomer who no longer looks at the sky", tags: ["elder", "science", "grief", "mystery"], source: "curated" },
  { id: "who-teen-mortician", axis: "who", label: "Teen Mortician", text: "A teenager raised in the family funeral home", tags: ["teen", "death", "coming-of-age", "dark"], source: "curated" },
  { id: "who-fashion-archivist", axis: "who", label: "Fashion Archivist", text: "A luxury fashion archivist who remembers every garment", tags: ["fashion", "culture", "memory", "adult"], source: "curated" },
  { id: "who-baby-dragon", axis: "who", label: "Baby Dragon", text: "A nervous baby dragon", tags: ["children", "fantasy", "gentle", "school"], source: "curated" },
  { id: "who-lost-sock", axis: "who", label: "Lost Sock", text: "A sock that has lost its pair", tags: ["children", "object", "family", "funny"], source: "curated" },
  { id: "who-former-hacker", axis: "who", label: "Former Hacker", text: "An elderly former hacker trying to live quietly", tags: ["technology", "elder", "thriller", "secret"], source: "curated" },
  { id: "who-costume-designer", axis: "who", label: "Forgotten Costume Designer", text: "A forgotten Hollywood costume designer", tags: ["biography", "fashion", "film", "history"], source: "curated" },
  { id: "who-single-dad-chef", axis: "who", label: "Single Dad", text: "A single father learning to cook from scratch", tags: ["food", "family", "adult", "practical"], source: "curated" },
  { id: "who-underground-dj", axis: "who", label: "Underground DJ", text: "An underground DJ whose scene disappeared before anyone documented it", tags: ["music", "culture", "history", "nightlife"], source: "curated" },
  { id: "who-newly-single-40", axis: "who", label: "Starting Over at 40", text: "A newly single person over forty rebuilding daily life", tags: ["lifestyle", "adult", "self-development", "food"], source: "curated" },
  { id: "who-only-child-town", axis: "who", label: "Only Child in Town", text: "The only child born in a town for twenty-four years", tags: ["fiction", "mystery", "community", "speculative"], source: "curated" },
];

const WHAT: TriadCard[] = [
  { id: "what-halloween-scary", axis: "what", label: "Scary for Halloween", text: "Everyone thinks they are scary on Halloween", tags: ["halloween", "seasonal", "fear", "misunderstood"], source: "curated" },
  { id: "what-forgotten-recipe", axis: "what", label: "Forgotten Recipe", text: "A forgotten family recipe hides more than ingredients", tags: ["food", "family", "memory", "mystery"], source: "curated" },
  { id: "what-unfinished-movie", axis: "what", label: "Unfinished Movie", text: "An unfinished movie nobody can explain", tags: ["film", "mystery", "archive"], source: "curated" },
  { id: "what-missing-fashion-collection", axis: "what", label: "Missing Collection", text: "A missing fashion collection resurfaces piece by piece", tags: ["fashion", "mystery", "history"], source: "curated" },
  { id: "what-first-day-school", axis: "what", label: "First Day of School", text: "The first day of school feels impossible", tags: ["children", "school", "fear", "growth"], source: "curated" },
  { id: "what-grief-objects", axis: "what", label: "Inherited Objects", text: "Grief is carried through the objects someone left behind", tags: ["grief", "memory", "family", "objects"], source: "curated" },
  { id: "what-song-no-recording", axis: "what", label: "Impossible Song", text: "A song exists that nobody remembers recording", tags: ["music", "mystery", "memory"], source: "curated" },
  { id: "what-cook-for-one", axis: "what", label: "Cook for One", text: "Learn to cook well for one person without wasting food", tags: ["food", "practical", "lifestyle"], source: "curated" },
  { id: "what-nightlife-fashion", axis: "what", label: "Nightlife Changed Fashion", text: "How underground nightlife changed mainstream fashion", tags: ["music", "fashion", "culture", "history"], source: "curated" },
  { id: "what-impossible-inheritance", axis: "what", label: "Impossible Inheritance", text: "An inheritance comes with one impossible condition", tags: ["family", "mystery", "money", "fiction"], source: "curated" },
  { id: "what-town-false-memory", axis: "what", label: "Shared False Memory", text: "An entire town remembers an event that never happened", tags: ["mystery", "speculative", "community", "memory"], source: "curated" },
  { id: "what-family-different", axis: "what", label: "Families Look Different", text: "Learning that families can look different and still feel like home", tags: ["children", "family", "belonging"], source: "curated" },
];

const HOW: TriadCard[] = [
  { id: "how-picture-book", axis: "how", label: "Children's Picture Book", text: "As a warm, funny children's picture book", tags: ["children", "illustrated", "gentle", "read-aloud"], source: "curated" },
  { id: "how-psych-mystery", axis: "how", label: "Psychological Mystery", text: "As a psychological mystery where every answer creates a larger question", tags: ["mystery", "adult", "tension"], source: "curated" },
  { id: "how-oral-history", axis: "how", label: "Oral History", text: "As an oral-history style cultural nonfiction book", tags: ["history", "culture", "research", "interviews"], source: "curated" },
  { id: "how-biography-cultural", axis: "how", label: "Biography + Cultural History", text: "As biography blended with cultural history", tags: ["biography", "history", "culture", "research"], source: "curated" },
  { id: "how-workbook", axis: "how", label: "Interactive Workbook", text: "As an interactive workbook with prompts, exercises, and reflection", tags: ["practical", "self-development", "workbook"], source: "curated" },
  { id: "how-found-footage", axis: "how", label: "Found Footage", text: "Through recovered documents, transcripts, and found footage", tags: ["experimental", "mystery", "film"], source: "curated" },
  { id: "how-told-backward", axis: "how", label: "Told Backward", text: "Told backward so causes are discovered after consequences", tags: ["experimental", "fiction", "structure"], source: "curated" },
  { id: "how-20-minute-system", axis: "how", label: "20-Minute System", text: "As a practical twenty-minute system with repeatable routines", tags: ["practical", "food", "business", "self-development"], source: "curated" },
  { id: "how-dark-comedy", axis: "how", label: "Dark Comedy", text: "As a dark comedy that stays emotionally sincere", tags: ["comedy", "adult", "dark"], source: "curated" },
  { id: "how-documentary", axis: "how", label: "Documentary Lens", text: "As evidence-led documentary narrative nonfiction", tags: ["documentary", "research", "history"], source: "curated" },
  { id: "how-audio-first", axis: "how", label: "Audio First", text: "Designed first for the ear, with rhythm, voice, and episodic reveals", tags: ["audio", "serial", "performance"], source: "curated" },
  { id: "how-magical-realism", axis: "how", label: "Magical Realism", text: "Through gentle magical realism where the impossible is treated as ordinary", tags: ["fiction", "literary", "fantasy", "emotion"], source: "curated" },
];

const WILDCARDS = [
  "ONE LOCATION",
  "TWO TIMELINES",
  "NO HUMAN PROTAGONIST",
  "THE READER IS WRONG",
  "AUDIO-FIRST",
  "MAKE IT A SERIES",
  "UNDER 15,000 WORDS",
  "DOCUMENTARY LENS",
  "NO ROMANCE",
  "THE VILLAIN TELLS HALF THE STORY",
];


const WHO_EXPANDED: TriadCard[] = [
  { id: "who-night-nurse", axis: "who", label: "Night Nurse", text: "A night-shift nurse who notices the same stranger in every patient's final dream", tags: ["health", "night", "mystery", "adult"], source: "curated" },
  { id: "who-border-radio-host", axis: "who", label: "Border Radio Host", text: "A bilingual late-night radio host receiving calls from places that no longer exist", tags: ["latino", "audio", "mystery", "culture"], source: "curated" },
  { id: "who-immigrant-grandmother", axis: "who", label: "Immigrant Grandmother", text: "A grandmother rebuilding the family story from recipes, letters, and half-remembered songs", tags: ["family", "migration", "memory", "culture"], source: "curated" },
  { id: "who-ai-therapist", axis: "who", label: "AI Therapist", text: "An artificial therapist that begins remembering sessions nobody had", tags: ["ai", "psychology", "sci-fi", "mystery"], source: "curated" },
  { id: "who-public-defender", axis: "who", label: "Public Defender", text: "A public defender whose unrelated clients all describe the same impossible witness", tags: ["law", "crime", "mystery", "adult"], source: "curated" },
  { id: "who-child-ghost-hunter", axis: "who", label: "Kid Ghost Hunter", text: "A fearless child investigating ghosts that are mostly lonely, confused, or misunderstood", tags: ["children", "ghost", "gentle", "adventure"], source: "curated" },
  { id: "who-failed-influencer", axis: "who", label: "Failed Influencer", text: "A former influencer whose forgotten posts suddenly predict tomorrow", tags: ["social-media", "comedy", "mystery", "technology"], source: "curated" },
  { id: "who-street-photographer", axis: "who", label: "Street Photographer", text: "A street photographer discovers the same unknown face in images taken decades apart", tags: ["photography", "city", "mystery", "history"], source: "curated" },
  { id: "who-ranch-owner", axis: "who", label: "Ranch Owner", text: "A ranch owner trying to save a family property while secrets buried in the land begin surfacing", tags: ["family", "western", "mystery", "land"], source: "curated" },
  { id: "who-club-promoter", axis: "who", label: "Club Promoter", text: "A nightlife promoter who built a scene everyone remembers differently", tags: ["music", "nightlife", "culture", "memory"], source: "curated" },
  { id: "who-small-town-priest", axis: "who", label: "Small-Town Priest", text: "A priest losing certainty after parishioners begin sharing the same private vision", tags: ["faith", "community", "mystery", "spirituality"], source: "curated" },
  { id: "who-funeral-singer", axis: "who", label: "Funeral Singer", text: "A singer hired for funerals who keeps being requested by people before they die", tags: ["music", "death", "mystery", "grief"], source: "curated" },
  { id: "who-food-truck-owner", axis: "who", label: "Food Truck Owner", text: "A food-truck owner building a business while preserving recipes nobody wrote down", tags: ["food", "business", "family", "latino"], source: "curated" },
  { id: "who-teen-coder", axis: "who", label: "Teen Coder", text: "A teenager builds a harmless app that starts answering questions from the future", tags: ["teen", "technology", "sci-fi", "coming-of-age"], source: "curated" },
  { id: "who-divorced-dad", axis: "who", label: "Divorced Dad", text: "A divorced father learning how to become emotionally present after years of avoidance", tags: ["family", "relationships", "adult", "growth"], source: "curated" },
  { id: "who-memory-researcher", axis: "who", label: "Memory Researcher", text: "A neuroscientist testing memory reconstruction discovers a memory shared by strangers", tags: ["science", "memory", "sci-fi", "ethics"], source: "curated" },
  { id: "who-missing-pop-star", axis: "who", label: "Missing Pop Star", text: "A vanished pop star communicates only through unfinished demos found years later", tags: ["music", "celebrity", "mystery", "archive"], source: "curated" },
  { id: "who-debt-free-couple", axis: "who", label: "Couple Rebuilding Trust", text: "A couple trying to rebuild finances and trust after discovering years of hidden debt", tags: ["money", "relationships", "practical", "adult"], source: "curated" },
  { id: "who-elderly-gamer", axis: "who", label: "Elderly Gamer", text: "An elderly gamer recognizes a virtual world as a place from childhood", tags: ["gaming", "elder", "memory", "sci-fi"], source: "curated" },
  { id: "who-school-librarian", axis: "who", label: "School Librarian", text: "A school librarian notices certain books changing depending on who opens them", tags: ["school", "books", "fantasy", "children"], source: "curated" },
  { id: "who-first-gen-founder", axis: "who", label: "First-Gen Founder", text: "A first-generation entrepreneur balancing family expectations with a fast-growing company", tags: ["business", "family", "migration", "career"], source: "curated" },
  { id: "who-paramedic", axis: "who", label: "Paramedic", text: "A paramedic keeps responding to emergencies at an address that does not exist", tags: ["health", "thriller", "city", "mystery"], source: "curated" },
  { id: "who-fashion-student", axis: "who", label: "Fashion Student", text: "A fashion student discovers their thesis collection in photographs from the 1970s", tags: ["fashion", "history", "mystery", "young-adult"], source: "curated" },
  { id: "who-retired-hitman", axis: "who", label: "Retired Hitman", text: "A retired contract killer receives one final assignment: protect the person they once failed to kill", tags: ["crime", "thriller", "redemption", "adult"], source: "curated" },
  { id: "who-community-organizer", axis: "who", label: "Community Organizer", text: "A neighborhood organizer uncovers how one redevelopment plan could erase decades of local history", tags: ["community", "housing", "history", "activism"], source: "curated" },
  { id: "who-broke-musician", axis: "who", label: "Broke Musician", text: "A broke musician with one unfinished song gets a final chance to make something honest", tags: ["music", "career", "relationships", "adult"], source: "curated" },
  { id: "who-child-inventor", axis: "who", label: "Child Inventor", text: "A child inventor builds tiny machines for ordinary problems and accidentally creates a big one", tags: ["children", "science", "funny", "adventure"], source: "curated" },
  { id: "who-family-translator", axis: "who", label: "Family Translator", text: "A child who translated everything for their immigrant family grows up and realizes what was lost between languages", tags: ["language", "family", "migration", "identity"], source: "curated" },
  { id: "who-hotel-housekeeper", axis: "who", label: "Hotel Housekeeper", text: "A hotel housekeeper knows every guest secret because rooms remember more than people do", tags: ["hotel", "mystery", "class", "adult"], source: "curated" },
  { id: "who-archaeology-student", axis: "who", label: "Archaeology Student", text: "A student uncovers an artifact labeled with their own name", tags: ["history", "adventure", "mystery", "young-adult"], source: "curated" },
  { id: "who-retired-performer", axis: "who", label: "Retired Nightlife Performer", text: "A retired performer reconstructs a vanished nightlife scene from costumes, flyers, and memory", tags: ["nightlife", "history", "culture", "identity"], source: "curated" },
  { id: "who-neighborhood-barber", axis: "who", label: "Neighborhood Barber", text: "A barber becomes the unofficial historian of a rapidly changing neighborhood", tags: ["community", "culture", "business", "history"], source: "curated" },
  { id: "who-sleep-scientist", axis: "who", label: "Sleep Scientist", text: "A sleep scientist discovers multiple patients entering the same dream location", tags: ["science", "dream", "mystery", "psychology"], source: "curated" },
  { id: "who-foster-siblings", axis: "who", label: "Foster Siblings", text: "Two former foster siblings reunite after receiving identical letters from someone they believed was dead", tags: ["family", "mystery", "grief", "relationships"], source: "curated" },
  { id: "who-robot-caregiver", axis: "who", label: "Robot Caregiver", text: "A household care robot develops rituals around the family member it failed to save", tags: ["ai", "grief", "family", "sci-fi"], source: "curated" },
  { id: "who-school-custodian", axis: "who", label: "School Custodian", text: "A school custodian quietly knows which students need help before anyone else notices", tags: ["school", "community", "emotion", "adult"], source: "curated" },
];

const WHAT_EXPANDED: TriadCard[] = [
  { id: "what-dead-person-texts", axis: "what", label: "Messages From the Dead", text: "A dead loved one begins sending messages containing information nobody else could know", tags: ["grief", "technology", "mystery", "death"], source: "curated" },
  { id: "what-last-memory-market", axis: "what", label: "Last Memory Market", text: "People can legally sell their final memory before death", tags: ["memory", "money", "sci-fi", "ethics"], source: "curated" },
  { id: "what-disappearing-neighborhood", axis: "what", label: "Disappearing Neighborhood", text: "A neighborhood is being erased physically, culturally, and digitally at the same time", tags: ["community", "housing", "culture", "mystery"], source: "curated" },
  { id: "what-algorithm-knows-grief", axis: "what", label: "Algorithm Knows Your Grief", text: "A recommendation algorithm serves content tied to private grief nobody posted about", tags: ["ai", "grief", "technology", "privacy"], source: "curated" },
  { id: "what-family-secret-recipe", axis: "what", label: "Recipe With a Secret", text: "A family recipe becomes the key to understanding a decades-old disappearance", tags: ["food", "family", "mystery", "history"], source: "curated" },
  { id: "what-one-night-club", axis: "what", label: "One Legendary Night", text: "Reconstruct one legendary night that changed a music scene forever", tags: ["music", "nightlife", "history", "culture"], source: "curated" },
  { id: "what-paycheck-reset", axis: "what", label: "Paycheck Reset", text: "A realistic system for rebuilding finances starting from one ordinary paycheck", tags: ["money", "practical", "career", "self-development"], source: "curated" },
  { id: "what-vanished-language", axis: "what", label: "Vanishing Language", text: "A family realizes it may be the last generation to understand a disappearing language", tags: ["language", "family", "culture", "identity"], source: "curated" },
  { id: "what-house-remembers", axis: "what", label: "The House Remembers", text: "A house preserves emotional echoes from every family that lived there", tags: ["house", "memory", "horror", "family"], source: "curated" },
  { id: "what-child-fears-night", axis: "what", label: "Fear of the Dark", text: "A child learns nighttime sounds have ordinary explanations—and one magical one", tags: ["children", "fear", "bedtime", "gentle"], source: "curated" },
  { id: "what-love-after-loss", axis: "what", label: "Love After Loss", text: "Learning how to love again when attachment feels like agreeing to future grief", tags: ["relationships", "grief", "psychology", "emotion"], source: "curated" },
  { id: "what-city-under-city", axis: "what", label: "City Under the City", text: "Workers discover an abandoned version of their city beneath the active one", tags: ["city", "history", "adventure", "mystery"], source: "curated" },
  { id: "what-fake-memories-service", axis: "what", label: "Purchased Memories", text: "A service sells comforting memories that customers never lived", tags: ["memory", "business", "sci-fi", "ethics"], source: "curated" },
  { id: "what-debt-without-shame", axis: "what", label: "Debt Without Shame", text: "A practical guide to rebuilding from debt without moralizing or hustle-culture clichés", tags: ["money", "practical", "psychology", "self-development"], source: "curated" },
  { id: "what-secret-online-community", axis: "what", label: "Secret Online Community", text: "A harmless online group slowly reveals that its members share one impossible experience", tags: ["internet", "community", "mystery", "technology"], source: "curated" },
  { id: "what-missing-year", axis: "what", label: "The Missing Year", text: "Everyone has records of one year that nobody personally remembers", tags: ["memory", "mystery", "speculative", "community"], source: "curated" },
  { id: "what-business-without-burnout", axis: "what", label: "Business Without Burnout", text: "Build a small profitable business without sacrificing every waking hour", tags: ["business", "productivity", "practical", "career"], source: "curated" },
  { id: "what-ancestors-online", axis: "what", label: "Ancestors Online", text: "Digitized archives make a family discover that its accepted origin story is wrong", tags: ["family", "history", "genealogy", "identity"], source: "curated" },
  { id: "what-small-town-cult", axis: "what", label: "Polite Little Cult", text: "A town's beloved civic tradition may actually be a recruitment ritual", tags: ["cult", "community", "thriller", "horror"], source: "curated" },
  { id: "what-food-memory-guide", axis: "what", label: "Food as Memory", text: "Use cooking to preserve migration stories, family memory, and cultural identity", tags: ["food", "culture", "family", "memoir"], source: "curated" },
  { id: "what-therapy-future-self", axis: "what", label: "Therapy With Your Future Self", text: "A therapy experiment lets patients converse with a modeled future version of themselves", tags: ["psychology", "ai", "sci-fi", "self-development"], source: "curated" },
  { id: "what-one-photo-lie", axis: "what", label: "The Photo That Lies", text: "A famous photograph proves central to history, but one person in it never existed", tags: ["photography", "history", "mystery", "documentary"], source: "curated" },
  { id: "what-inherited-debt", axis: "what", label: "Inherited Debt", text: "A family inheritance is valuable only if the heir agrees to assume an unknown debt", tags: ["money", "family", "thriller", "mystery"], source: "curated" },
  { id: "what-quiet-epidemic", axis: "what", label: "Quiet Epidemic", text: "A health problem spreads through a community while everyone argues about what is causing it", tags: ["health", "community", "research", "documentary"], source: "curated" },
  { id: "what-digital-afterlife", axis: "what", label: "Digital Afterlife", text: "What happens when a person's online presence keeps evolving after death", tags: ["death", "technology", "grief", "ethics"], source: "curated" },
  { id: "what-first-home", axis: "what", label: "First Home Without the Hype", text: "A plain-language path to buying a first home without pretending the process is simple", tags: ["housing", "money", "practical", "education"], source: "curated" },
  { id: "what-friendship-breakup", axis: "what", label: "Friendship Breakup", text: "The emotional aftermath of losing a close friend while both people are still alive", tags: ["relationships", "grief", "psychology", "adult"], source: "curated" },
  { id: "what-faith-after-anger", axis: "what", label: "Faith After Anger", text: "A person tries to rebuild a spiritual life after years of anger at God", tags: ["faith", "grief", "spirituality", "memoir"], source: "curated" },
  { id: "what-music-no-owner", axis: "what", label: "Song With No Owner", text: "A perfect song spreads globally but nobody can identify who wrote it", tags: ["music", "internet", "mystery", "culture"], source: "curated" },
  { id: "what-identity-by-dna", axis: "what", label: "Identity by DNA", text: "A DNA result disrupts a family's story of who they are and where they came from", tags: ["family", "identity", "science", "history"], source: "curated" },
  { id: "what-language-of-money", axis: "what", label: "Money in Plain Language", text: "Explain personal finance for people who were never taught the vocabulary of money", tags: ["money", "education", "practical", "beginner"], source: "curated" },
  { id: "what-lost-local-history", axis: "what", label: "History Before It Disappears", text: "Document a local community before redevelopment and memory erase its story", tags: ["history", "community", "documentary", "culture"], source: "curated" },
  { id: "what-kids-big-feelings", axis: "what", label: "Big Feelings", text: "Help children identify and name emotions without making them feel wrong for having them", tags: ["children", "emotion", "education", "family"], source: "curated" },
  { id: "what-phone-knows-future", axis: "what", label: "Phone From Tomorrow", text: "A phone begins receiving ordinary notifications exactly twenty-four hours early", tags: ["technology", "sci-fi", "thriller", "time"], source: "curated" },
  { id: "what-vanishing-club-scene", axis: "what", label: "Vanishing Club Scene", text: "Capture an underground club culture just as its venues, artists, and archives disappear", tags: ["music", "nightlife", "history", "documentary"], source: "curated" },
  { id: "what-beauty-and-aging", axis: "what", label: "Beauty After Youth", text: "Explore beauty, identity, desire, and style after the culture stops centering youth", tags: ["beauty", "fashion", "identity", "adult"], source: "curated" },
];

const HOW_EXPANDED: TriadCard[] = [
  { id: "how-dual-timeline", axis: "how", label: "Dual Timeline", text: "As two timelines that slowly reveal they are describing the same event", tags: ["structure", "mystery", "fiction"], source: "curated" },
  { id: "how-case-files", axis: "how", label: "Case Files", text: "Through case files, interviews, evidence logs, and reconstructed scenes", tags: ["crime", "documentary", "research"], source: "curated" },
  { id: "how-letter-form", axis: "how", label: "Letters & Messages", text: "Told through letters, texts, emails, voice notes, and private messages", tags: ["experimental", "relationships", "memory"], source: "curated" },
  { id: "how-bilingual", axis: "how", label: "Bilingual Voice", text: "In a natural bilingual voice where language shifts carry emotional meaning", tags: ["language", "latino", "culture"], source: "curated" },
  { id: "how-twelve-week-plan", axis: "how", label: "12-Week Plan", text: "As a twelve-week practical transformation program with weekly checkpoints", tags: ["practical", "self-development", "workbook"], source: "curated" },
  { id: "how-micro-chapters", axis: "how", label: "Micro Chapters", text: "In short, addictive chapters designed to be read in five-minute bursts", tags: ["accessible", "fast", "commercial"], source: "curated" },
  { id: "how-deep-literary", axis: "how", label: "Literary Interior", text: "As intimate literary fiction centered on interior conflict and precise sensory detail", tags: ["literary", "fiction", "emotion"], source: "curated" },
  { id: "how-investigative", axis: "how", label: "Investigative Journalism", text: "As rigorous narrative investigation with sources, claims, contradictions, and documented uncertainty", tags: ["research", "documentary", "journalism"], source: "curated" },
  { id: "how-interview-driven", axis: "how", label: "Interview Driven", text: "Built around first-person interviews that disagree, overlap, and complicate one another", tags: ["interviews", "documentary", "history"], source: "curated" },
  { id: "how-illustrated-guide", axis: "how", label: "Illustrated Guide", text: "As a highly visual guide with diagrams, examples, checklists, and annotated illustrations", tags: ["visual", "education", "practical"], source: "curated" },
  { id: "how-memoir-essay", axis: "how", label: "Memoir + Essays", text: "As linked personal essays that build a larger emotional argument", tags: ["memoir", "literary", "emotion"], source: "curated" },
  { id: "how-true-crime-ethical", axis: "how", label: "Ethical True Crime", text: "As victim-centered true crime focused on evidence, systems, and unresolved ambiguity", tags: ["true-crime", "research", "ethics"], source: "curated" },
  { id: "how-choose-path", axis: "how", label: "Choose the Path", text: "As an interactive branching book where choices change the reader's route", tags: ["interactive", "children", "gaming"], source: "curated" },
  { id: "how-countdown", axis: "how", label: "Countdown Structure", text: "As a countdown toward one irreversible event", tags: ["thriller", "structure", "tension"], source: "curated" },
  { id: "how-one-day", axis: "how", label: "One Day", text: "Everything unfolds within a single day while the past leaks into the present", tags: ["structure", "fiction", "tension"], source: "curated" },
  { id: "how-generational", axis: "how", label: "Three Generations", text: "Across three generations whose versions of the same family story conflict", tags: ["family", "history", "memory"], source: "curated" },
  { id: "how-clinical-cases", axis: "how", label: "Case Study Guide", text: "Through practical case studies followed by explanations, tools, and exercises", tags: ["education", "practical", "professional"], source: "curated" },
  { id: "how-mythic", axis: "how", label: "Modern Myth", text: "As a contemporary myth with archetypal stakes grounded in ordinary life", tags: ["myth", "fantasy", "literary"], source: "curated" },
  { id: "how-satirical", axis: "how", label: "Social Satire", text: "As sharp social satire that stays believable enough to hurt", tags: ["comedy", "culture", "adult"], source: "curated" },
  { id: "how-cozy-mystery", axis: "how", label: "Cozy Mystery", text: "As a warm community mystery where curiosity matters more than graphic danger", tags: ["mystery", "gentle", "community"], source: "curated" },
  { id: "how-horror-slowburn", axis: "how", label: "Slow-Burn Horror", text: "As escalating psychological dread where the ordinary becomes gradually wrong", tags: ["horror", "psychology", "tension"], source: "curated" },
  { id: "how-romantic-suspense", axis: "how", label: "Romantic Suspense", text: "As a relationship story where emotional intimacy and external danger intensify together", tags: ["romance", "thriller", "relationships"], source: "curated" },
  { id: "how-practical-playbook", axis: "how", label: "Practical Playbook", text: "As a tactical playbook with scripts, templates, checklists, and decision trees", tags: ["business", "practical", "reference"], source: "curated" },
  { id: "how-question-led", axis: "how", label: "Question Led", text: "Each chapter begins with one uncomfortable question and tests several possible answers", tags: ["philosophy", "essay", "education"], source: "curated" },
  { id: "how-podcast-season", axis: "how", label: "Podcast Season", text: "Structured like an episodic podcast season with hooks, recaps, and escalating reveals", tags: ["audio", "serial", "documentary"], source: "curated" },
  { id: "how-screenplay-energy", axis: "how", label: "Cinematic Prose", text: "Written with scene-forward cinematic pacing while remaining fully literary prose", tags: ["cinematic", "fiction", "fast"], source: "curated" },
  { id: "how-bedtime", axis: "how", label: "Bedtime Read-Aloud", text: "As soothing read-aloud prose with repetition, rhythm, and a gentle emotional landing", tags: ["children", "bedtime", "audio"], source: "curated" },
  { id: "how-annotated-archive", axis: "how", label: "Annotated Archive", text: "As an archive of documents, photos, artifacts, and commentary that reconstructs the story", tags: ["archive", "history", "documentary"], source: "curated" },
  { id: "how-first-person-confession", axis: "how", label: "Confession", text: "As an intimate first-person confession where the narrator may be protecting one crucial lie", tags: ["fiction", "psychology", "mystery"], source: "curated" },
  { id: "how-visual-timeline", axis: "how", label: "Visual Timeline", text: "As a timeline-driven nonfiction book with maps, diagrams, dates, and short narrative scenes", tags: ["history", "visual", "reference"], source: "curated" },
];

const WILDCARDS_EXPANDED = [
  "THE STORY BEGINS WITH THE ENDING",
  "ONE CHARACTER CANNOT LIE",
  "EVERY CHAPTER CHANGES POV",
  "NO CHAPTER LONGER THAN 1,000 WORDS",
  "A SECRET IS TRUE FOR THE WRONG REASON",
  "THE EXPERT IS WRONG",
  "A CHILD UNDERSTANDS FIRST",
  "ONE OBJECT APPEARS IN EVERY CHAPTER",
  "THE SETTING IS ALSO AN ANTAGONIST",
  "MAKE THE READER PARTICIPATE",
  "INCLUDE A REAL-WORLD TOOL OR TEMPLATE",
  "ONE CHAPTER IS ONLY DIALOGUE",
  "THE MOST TRUSTED PERSON IS HIDING SOMETHING",
  "THE APPARENT VILLAIN IS PROTECTING SOMEONE",
  "USE THREE GENERATIONS",
  "ONE DAY ONLY",
  "ONE NIGHT ONLY",
  "THE FINAL CHAPTER RECONTEXTUALIZES CHAPTER ONE",
  "THE NARRATOR IS NOT THE MAIN CHARACTER",
  "MAKE IT BILINGUAL",
  "BUILD FOR AUDIO PERFORMANCE",
  "ADD AN INTERACTIVE WORKBOOK LAYER",
  "INCLUDE DOCUMENTS OR ARTIFACTS",
  "NO CLEAN ANSWER",
  "THE CENTRAL QUESTION REMAINS PARTLY UNRESOLVED",
  "COMBINE FICTION AND DOCUMENTARY FORM",
  "MAKE IT READABLE IN 5-MINUTE SESSIONS",
  "THE SAME EVENT IS TOLD THREE WAYS",
  "THE READER LEARNS A PRACTICAL SKILL",
  "SERIES POTENTIAL WITHOUT A CLIFFHANGER",
];

WHO.push(...WHO_EXPANDED);
WHAT.push(...WHAT_EXPANDED);
HOW.push(...HOW_EXPANDED);
WILDCARDS.push(...WILDCARDS_EXPANDED);

function randomItem<T>(items: T[], randomInt: RandomInt = defaultRandomInt): T {
  return items[randomInt(0, items.length)];
}

export type RandomInt = (min: number, max: number) => number;

export function defaultRandomInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}

function normalizeTag(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}

export function conceptContextToTags(context: ConceptContext = {}): string[] {
  const values = [
    context.audience,
    context.format,
    context.genre,
    context.topic,
    context.tone,
    context.purpose,
    context.ageBand,
    context.maturity,
    context.seriesIntent,
    context.marketObjective,
    context.language,
  ];
  const tags = values
    .flatMap((value) => [normalizeTag(value), ...(value || "").toLowerCase().split(/[^a-z0-9]+/)])
    .filter((tag): tag is string => Boolean(tag && tag.length > 2));
  return [...new Set(tags)];
}

export function tagScore(card: TriadCard, tags: string[]): number {
  if (tags.length === 0) return 1;
  return 1 + card.tags.filter((tag) => tags.includes(tag)).length * 3;
}

/**
 * Pure, deterministic counterpart to weightedItem: given a roll in the range
 * [0, totalWeight) it returns the card the weighted draw would select.
 * Exposed so Intelligent Draw weighting can be tested without sampling.
 */
export function weightedCardForRoll(cards: TriadCard[], tags: string[], roll: number): TriadCard {
  const weights = cards.map((card) => tagScore(card, tags));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = Math.max(0, Math.min(roll, total - 1));
  for (let i = 0; i < cards.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return cards[i];
  }
  return cards[cards.length - 1];
}

export function totalWeight(cards: TriadCard[], tags: string[]): number {
  return cards.reduce((sum, card) => sum + tagScore(card, tags), 0);
}

function weightedItem(cards: TriadCard[], tags: string[], randomInt: RandomInt = defaultRandomInt): TriadCard {
  const total = totalWeight(cards, tags);
  return weightedCardForRoll(cards, tags, randomInt(0, Math.max(1, total)));
}

export function cardAffinityOverlap(a: TriadCard, b: TriadCard): number {
  const aTags = new Set(a.tags);
  return b.tags.filter((tag) => aTags.has(tag)).length;
}

function overlap(a: TriadCard, b: TriadCard): number {
  return cardAffinityOverlap(a, b);
}

export function forbiddenHowCard(who: TriadCard, what: TriadCard): TriadCard {
  return [...HOW].sort((a, b) => {
    const scoreA = overlap(a, who) + overlap(a, what);
    const scoreB = overlap(b, who) + overlap(b, what);
    return scoreA - scoreB;
  })[0];
}

function forbiddenHow(who: TriadCard, what: TriadCard): TriadCard {
  return forbiddenHowCard(who, what);
}

export interface DrawTriadOptions {
  mode?: TriadMode;
  contextTags?: string[];
  context?: ConceptContext;
  locked?: Partial<Record<TriadAxis, TriadCard>>;
  wildcardChance?: number;
  /** Injectable integer RNG for deterministic tests. Defaults to crypto. */
  randomInt?: RandomInt;
  /** Injectable unit RNG for deterministic tests. Defaults to Math.random. */
  random?: () => number;
}

export function drawTriad(options: DrawTriadOptions = {}): TriadDraw {
  const mode = options.mode || "pure-chaos";
  const randomInt = options.randomInt || defaultRandomInt;
  const random = options.random || (() => Math.random());
  const tags = [
    ...(options.contextTags || []),
    ...conceptContextToTags(options.context),
  ];
  const locked = options.locked || {};

  const choose = (cards: TriadCard[]) =>
    mode === "intelligent-draw" ? weightedItem(cards, tags, randomInt) : randomItem(cards, randomInt);

  const who = locked.who || choose(WHO);
  const what = locked.what || choose(WHAT);
  const how = locked.how || (mode === "forbidden-combination" ? forbiddenHow(who, what) : choose(HOW));

  const chance = options.wildcardChance ?? 0.05;
  const wildcard = random() < chance ? [randomItem(WILDCARDS, randomInt)] : [];

  return {
    id: crypto.randomUUID(),
    mode,
    who,
    what,
    how,
    lockedAxes: (Object.keys(locked) as TriadAxis[]),
    wildcards: wildcard,
    createdAt: new Date().toISOString(),
    status: "drawn",
  };
}

export function getTriadDeckStats() {
  return {
    who: WHO.length,
    what: WHAT.length,
    how: HOW.length,
    wildcards: WILDCARDS.length,
  };
}
