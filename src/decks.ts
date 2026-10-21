import type { Spectrum } from "./types.ts";

/**
- Design rules for every spectrum:
-  1. Both ends sit on ONE axis (same subject, opposite extremes).
-  2. Any clue ("pineapple", "your ex", "Shrek") can be placed somewhere between.
-  3. Wording is parallel: "Worst X / Best X", "Boring X / Thrilling X", etc.
-  4. No duplicates, no cross-subject pairs.
 */

// ------------------------------------------------------------------
// SFW / CLEAN: Fun, family-friendly, relatable party scale
// ------------------------------------------------------------------

export const CLEAN_SPECTRUMS: Spectrum[] = [
  // People & Relationships
  { left: "Toxic Company", right: "Great Company" },
  { left: "Forgettable Person", right: "Unforgettable Person" },
  { left: "Bad Influence", right: "Role Model" },
  { left: "Terrible Roommate", right: "Dream Roommate" },
  { left: "Disloyal Friend", right: "Loyal Friend" },
  { left: "Bad Pet Owner", right: "Great Pet Owner" },
  { left: "Rude Tourist", right: "Ideal Tourist" },
  { left: "Annoying Habit", right: "Endearing Quirk" },
  { left: "Bad Neighbor", right: "Best Neighbor" },
  { left: "Terrible Boss", right: "Dream Boss" },
  { left: "Awful Coworker", right: "Perfect Coworker" },
  { left: "Bad Driver", right: "Great Driver" },
  { left: "Terrible Houseguest", right: "Perfect Houseguest" },
  { left: "Worst Teacher", right: "Best Teacher" },
  { left: "Embarrassing Parent", right: "Cool Parent" },
  { left: "Bad Gym Etiquette", right: "Great Gym Etiquette" },
  { left: "Introvert", right: "Extrovert" },
  { left: "Pushover", right: "Bossy" },

  // Food & Drink
  { left: "Dry Food", right: "Wet Food" },
  { left: "Fork Food", right: "Finger Food" },
  { left: "Worst Pizza Topping", right: "Best Pizza Topping" },
  { left: "Terrible Ice Cream Flavor", right: "Innovative Ice Cream Flavor" },
  { left: "Disgusting Food Combo", right: "Genius Food Combo" },
  { left: "Light Breakfast", right: "Heavy Feast" },
  { left: "Awful Coffee", right: "Perfect Coffee" },
  { left: "Boring Drink", right: "Elite Drink" },
  { left: "Worst Smell", right: "Best Smell" },
  { left: "Worst Snack", right: "Best Snack" },
  { left: "Worst Leftover", right: "Best Leftover" },
  { left: "Healthy Meal", right: "Guilty Pleasure Meal" },
  { left: "Light Meal", right: "Heavy Meal" },
  { left: "Continental Cuisine", right: "Desi Cuisine" },

  // Entertainment & Pop Culture
  { left: "Forgettable Movie", right: "Life-Changing Movie" },
  { left: "Scary Movie", right: "Funny Movie" },
  { left: "Devastating Movie", right: "Feel-Good Movie" },
  { left: "Bad Plot", right: "Brilliant Plot" },
  { left: "Boring Sitcom", right: "Hilarious Sitcom" },
  { left: "Annoying TV Character", right: "Fan-Favorite Character" },
  { left: "Forgettable Song", right: "Earworm" },
  { left: "Worst Karaoke Song", right: "Best Karaoke Song" },
  { left: "Loud Music", right: "Chill Music" },
  { left: "Terrible Band Name", right: "Iconic Band Name" },
  { left: "Boring Podcast", right: "Binge-Worthy Podcast" },
  { left: "Boring Hobby", right: "Addictive Hobby" },
  { left: "Useless App", right: "Must-Have App" },
  { left: "Cringe Trend", right: "Iconic Trend" },
  { left: "Culturally Irrelevant", right: "Culturally Iconic" },
  { left: "Annoying Ad", right: "Iconic Ad" },
  { left: "Annoying Catchphrase", right: "Iconic Catchphrase" },
  { left: "Terrible Mascot", right: "Beloved Mascot" },
  { left: "Weak Video Game", right: "Legendary Video Game" },
  { left: "Villain", right: "Hero" },
  { left: "Lame Name", right: "Iconic Name" },
  { left: "Forgettable Stage Name", right: "Legendary Stage Name" },

  // Humor, Social Moments & Creativity
  { left: "Lame Party Trick", right: "Insane Party Trick" },
  { left: "Awkward Topic", right: "Great Conversation Topic" },
  { left: "Weak Excuse", right: "Believable Excuse" },
  { left: "Awful Pickup Line", right: "Smooth Pickup Line" },
  { left: "Awful First Text", right: "Perfect First Text" },
  { left: "Mean Prank", right: "Harmless Prank" },
  { left: "Weak Team Name", right: "Intimidating Team Name" },
  { left: "Cringe Poster", right: "Actually Motivating Poster" },
  { left: "Hot Take", right: "Cold Take" },
  { left: "Serious Topic", right: "Silly Topic" },
  { left: "Awful First Date", right: "Perfect First Date" },
  { left: "Terrible Tattoo", right: "Meaningful Tattoo" },

  // Objects, Places & Everyday Life
  { left: "Terrible Gift", right: "Perfect Gift" },
  { left: "Useless Life Hack", right: "Game-Changing Life Hack" },
  { left: "Worst Invention", right: "Life-Changing Invention" },
  { left: "Useless Notification", right: "Important Notification" },
  { left: "Poorly Made", right: "Built to Last" },
  { left: "Comfy Clothes", right: "Fashionable Clothes" },
  { left: "Annoying Sound", right: "Satisfying Sound" },
  { left: "Worst Vacation", right: "Dream Vacation" },
  { left: "Weird to Own", right: "Normal to Own" },
  { left: "Middle Class", right: "Elite" },
  { left: "Old Fashioned", right: "Modern" },
  { left: "Underpaid Job", right: "Overpaid Job" },
  { left: "Underrated Skill", right: "Overrated Skill" },
  { left: "Sweaty", right: "Fresh" },
  { left: "Ugly", right: "Beautiful" },
  { left: "Useless", right: "Useful" },
  { left: "Ugly Dog Breeds", right: "Cute Dog Breeds" },
  { left: "Common Pet Names", right: "Impressive Pet Names" },

  // Life, Habits & Concepts
  { left: "Worst Day", right: "Best Day" },
  { left: "Awful Timing", right: "Perfect Timing" },
  { left: "Want", right: "Need" },
  { left: "Easy Task", right: "Hard Task" },
  { left: "Rigid", right: "Flexible" },
  { left: "Childish", right: "Mature" },
  { left: "Unhealthy Habit", right: "Healthy Habit" },
  { left: "Awful Exercise", right: "Fun Exercise" },
  { left: "Useless Superpower", right: "God-Tier Superpower" },
  { left: "Worst Superpower Side Effect", right: "Best Superpower Perk" },
  { left: "Fake Sick Day", right: "Valid Sick Day" },
  { left: "Annoying Abbreviation", right: "Useful Abbreviation" },
  { left: "Childhood Fear", right: "Childhood Joy" },
  { left: "Dumb Breakup Reason", right: "Valid Breakup Reason" },
  { left: "Messy Breakup", right: "Respectful Breakup" },
  { left: "Unromantic", right: "Heart-Melting" },
];

// ------------------------------------------------------------------
// SPICY: Flirting, dating, red flags, party vibes, cheeky innuendo
// ------------------------------------------------------------------

export const SPICY_SPECTRUMS: Spectrum[] = [
  // Attraction & Chemistry
  { left: "Friendly Banter", right: "Bedroom Eyes" },
  { left: "Zero Chemistry", right: "Electric Chemistry" },
  { left: "Friend Zoned By Her", right: "Friend Zoned By Him" },
  { left: "Hard Pass", right: "Absolute Yes" },
  { left: "Cute", right: "Irresistible" },
  { left: "Awkward Interference", right: "MVP Wingman Move" },
  { left: "Professional Scent", right: "Intimate Scent" },
  { left: "Unstylish Outfit", right: "Head-Turning Outfit" },
  { left: "Sweatpants and a Hoodie", right: "Practically Underwear" },
  { left: "Casual Snapshot", right: "Calculated Thirst Trap" },
  { left: "Cute Pet Name", right: "Forbidden Pet Name" },
  { left: "Forgettable Face", right: "Face You Think About in the Shower" },
  { left: "Average Build", right: "Greek God Physique" },

  // Dating & Relationships
  { left: "Dull Date", right: "Date That Ends Up in Bed" },
  { left: "Dry Peck", right: "Toe-Curling Kiss" },
  { left: "Awkward Goodnight Hug", right: "Stay The Night" },
  { left: "First Date Ick", right: "Tenth Date Red Flag" },
  { left: "Common Dating Bio", right: "Rare Gem Bio" },
  { left: "Left Swipe Energy", right: "Super Like Energy" },
  { left: "Hard to Get", right: "Zero Resistance" },
  { left: "Slow Burn", right: "Straight to the Point" },
  { left: "Netflix and Actually Watch Movies", right: "Netflix and Chill" },
  { left: "Keep It Quiet", right: "Sneaky Link" },
  { left: "Happily Taken", right: "Single and Ready" },
  { left: "One-Night Stand", right: "Soulmate" },
  { left: "Pure Lust", right: "True Love" },
  { left: "Ambiguous Situationship", right: "Committed Relationship" },
  { left: "Honeymoon Phase", right: "Roommates in a Rut" },

  // Texting & Social Media
  { left: "Left on Read", right: "Instant Reply" },
  { left: "Casual Check-In", right: "Late-Night Invitation" },
  { left: "Sober Text", right: "Regretful Drunk Text" },
  { left: "Wholesome Selfie", right: "Risky Selfie" },
  { left: "Safe for Work", right: "Fired If Your Boss Sees It" },
  { left: "Public Comment", right: "Private Story Reply" },

  // Red Flags & Vibes
  { left: "Green Flag Parade", right: "Red Flag Carnival" },
  { left: "Clingy", right: "Emotionally Unavailable" },
  { left: "Insecure Partner", right: "Secure Partner" },
  { left: "Platonic Friend", right: "Secret Crush With Motives" },
  { left: "Harmless Quirk", right: "Instant Dealbreaker" },
  { left: "Healthy Boundary", right: "Controlling Behavior" },
  { left: "Parent's Favorite", right: "Parent's Worst Nightmare" },
  { left: "The Good Guy", right: "Bad Idea in Leather" },
  { left: "Husband Material", right: "Wild Adventure" },
  { left: "Deep Dark Secret", right: "Open Secret" },
  { left: "Taking It to the Grave", right: "Telling the Group Chat" },
];

// ------------------------------------------------------------------
// DIRTY: Adults-only bedroom humor, intimacy styles, physical vibes
// ------------------------------------------------------------------

export const DIRTY_SPECTRUMS: Spectrum[] = [
  // Bedroom Styles & Mechanics
  { left: "Completely Vanilla", right: "Adventurous and Kinky" },
  { left: "Innocent", right: "Naughty" },
  { left: "Gentle Touch", right: "Rough Touch" },
  { left: "Quick and Quiet", right: "Neighbors Know Your Name" },
  { left: "Pretending", right: "Genuinely Seeing Stars" },
  { left: "Lights Off, Under Covers", right: "Lights On & Full Mirror" },
  { left: "Hesitant Start", right: "Hands Everywhere" },
  { left: "Cold Shower", right: "Steamy Shower for Two" },
  { left: "Slow Undressing", right: "Loses Clothes Immediately" },
  { left: "Needing Reassurance", right: "Taking Total Control" },
  { left: "Soft Whisper", right: "Leaving a Mark" },

  // Vibe & Communication
  { left: "Boring Accessory", right: "Must-Have Toy" },
  { left: "Wholesome Vibe", right: "Filthy Vibe" },
  { left: "Sweet Nothings", right: "Explicit Dirty Talk" },
  { left: "Terrible Playlist", right: "Perfect Mood Music" },
  { left: "Total Turn-Off", right: "Instant Turn-On" },
  { left: "Wild Fantasy", right: "Dull Reality" },
  { left: "Tame Behavior", right: "Unhinged Behavior" },

  // Situations & Morning After
  { left: "Keeping Distance", right: "Risk of Public Indecency" },
  { left: "Ignored Potential", right: "Hooked Up Immediately" },
  { left: "Short-Term", right: "Long-Term" },
  { left: "Instant Regret", right: "Zero Regrets" },
  { left: "Sneaking Out at Dawn", right: "Breakfast in Bed" },
  { left: "Worst Walk of Shame", right: "Proud Walk of Pride" },
  { left: "Taking Everything", right: "Leaving Something Behind" },
  { left: "Cuddle Afterwards", right: "Roll Over and Snore" },
];
