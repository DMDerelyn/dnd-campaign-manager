/**
 * Pools of D&D-flavored first + last names by race. Small curated lists
 * that feel appropriate without leaning on any specific setting's IP.
 */

export type NameRace =
	| "human"
	| "elf"
	| "dwarf"
	| "halfling"
	| "dragonborn"
	| "tiefling"
	| "gnome"
	| "half-orc"
	| "orc";

interface NamePool {
	first: string[];
	last: string[];
}

const NAMES: Record<NameRace, NamePool> = {
	human: {
		first: [
			"Aldric", "Brennor", "Cedric", "Darian", "Edmond", "Fenris", "Gavriel",
			"Hadrian", "Isolde", "Jocelyn", "Kaelin", "Lysandra", "Mara", "Nimue",
			"Odette", "Phelan", "Rowan", "Sable", "Talia", "Vera",
		],
		last: [
			"Ashworth", "Blackwood", "Caldwell", "Drake", "Everhart", "Foxglove",
			"Graves", "Hollow", "Ironwood", "Kingsley", "Locke", "Marsh", "Nightingale",
			"Ormsby", "Pendrake", "Ravenscar", "Silvermist", "Thorne", "Whitlock",
		],
	},
	elf: {
		first: [
			"Aerendyl", "Aramil", "Celeborn", "Daleriel", "Elenion", "Faelar",
			"Galadriel", "Haelwyn", "Ilyria", "Jalendrel", "Kaelariel", "Lirethiel",
			"Mithriel", "Naiviel", "Oriel", "Palendir", "Quellareth", "Riluatha",
			"Sylvarin", "Thaeliniel", "Undoriel", "Vaeluned", "Yllien",
		],
		last: [
			"Amarillis", "Brightstar", "Celestar", "Dawnwhisper", "Elanesse",
			"Faerwynd", "Goldenleaf", "Hawklight", "Illuminar", "Leafshimmer",
			"Moonshadow", "Nightbreeze", "Silverbranch", "Starsong", "Willowbrook",
		],
	},
	dwarf: {
		first: [
			"Adrik", "Balin", "Brottor", "Dain", "Eberk", "Fargrim", "Gardain",
			"Harbek", "Kildrak", "Morgran", "Orsik", "Rurik", "Taklinn", "Thorek",
			"Ulfgar", "Veit", "Audhild", "Dagnal", "Finellen", "Hlin", "Kathra",
			"Kristryd", "Torbera", "Vistra",
		],
		last: [
			"Axeheart", "Battlehammer", "Brawnanvil", "Deepdelver", "Firebeard",
			"Goldforge", "Granitefist", "Ironshaper", "Oakenshield", "Rockseeker",
			"Silverstone", "Stonefoot", "Strakeln", "Thunderfoot", "Warbraid",
		],
	},
	halfling: {
		first: [
			"Andry", "Bree", "Cade", "Eldon", "Finnan", "Garret", "Lindal",
			"Lyle", "Merric", "Milo", "Osborn", "Perrin", "Reed", "Roscoe",
			"Wellby", "Andara", "Callie", "Euphemia", "Jillian", "Kithri",
			"Lidda", "Merla", "Nedda", "Portia", "Seraphina", "Verna",
		],
		last: [
			"Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Hilltopple",
			"Leagallow", "Tealeaf", "Thorngage", "Tosscobble", "Underbough",
		],
	},
	dragonborn: {
		first: [
			"Arjhan", "Balasar", "Donaar", "Ghesh", "Heskan", "Kriv", "Medrash",
			"Mehen", "Nadarr", "Pandjed", "Patrin", "Rhogar", "Shamash", "Tarhun",
			"Torinn", "Akra", "Biri", "Daar", "Farideh", "Harann", "Havilar",
			"Jheri", "Kava", "Korinn", "Mishann", "Nala", "Perra", "Raiann",
			"Sora", "Surina", "Thava", "Uadjit",
		],
		last: [
			"Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion",
			"Fenkenkabradon", "Kepeshkmolik", "Kerrhylon", "Kimbatuul",
			"Linxakasendalor", "Myastan", "Nemmonis", "Norixius", "Ophinshtalajiir",
			"Prexijandilin", "Shestendeliath", "Turnuroth", "Verthisathurgiesh",
			"Yarjerit",
		],
	},
	tiefling: {
		first: [
			"Akmenos", "Amnon", "Barakas", "Damakos", "Ekemon", "Iados", "Kairon",
			"Leucis", "Melech", "Mordai", "Morthos", "Pelaios", "Skamos", "Therai",
			"Akta", "Anakis", "Bryseis", "Criella", "Damaia", "Ea", "Kallista",
			"Lerissa", "Makaria", "Nemeia", "Orianna", "Phelaia", "Rieta",
		],
		last: [
			"Art", "Carrion", "Chant", "Creed", "Despair", "Excellence", "Fear",
			"Glory", "Hope", "Ideal", "Music", "Nowhere", "Open", "Poetry",
			"Quest", "Random", "Reverence", "Sorrow", "Temerity", "Torment",
		],
	},
	gnome: {
		first: [
			"Alston", "Alvyn", "Boddynock", "Brocc", "Burgell", "Dimble", "Eldon",
			"Erky", "Fonkin", "Frug", "Gerbo", "Gimble", "Glim", "Jebeddo",
			"Kellen", "Namfoodle", "Orryn", "Roondar", "Seebo", "Sindri", "Warryn",
			"Wrenn", "Zook", "Bimpnottin", "Breena", "Caramip", "Carlin",
			"Donella", "Duvamil", "Ella", "Ellyjobell", "Ellywick", "Lilli",
			"Loopmottin", "Lorilla", "Mardnab", "Nissa", "Nyx", "Oda", "Orla",
			"Roywyn", "Shamil", "Tana", "Waywocket", "Zanna",
		],
		last: [
			"Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Murnig", "Ningel",
			"Raulnor", "Scheppen", "Timbers", "Turen",
		],
	},
	"half-orc": {
		first: [
			"Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk",
			"Mhurren", "Ront", "Shump", "Thokk", "Baggi", "Emen", "Engong",
			"Kansif", "Myev", "Neega", "Ovak", "Ownka", "Shautha", "Sutha",
			"Vola", "Volen", "Yevelda",
		],
		last: [
			"Axebound", "Blackfang", "Bonecrusher", "Grimfist", "Ironjaw",
			"Shadowmaul", "Skullcleaver", "Stormhowl", "Warwrecker",
		],
	},
	orc: {
		first: [
			"Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk",
			"Mhurren", "Ront", "Shump", "Thokk", "Urgh", "Vorg", "Zorug",
		],
		last: [
			"Axebound", "Blackfang", "Bloodtusk", "Bonecrusher", "Grimfist",
			"Ironjaw", "Shadowmaul", "Skullcleaver", "Stormhowl",
		],
	},
};

export const NAME_RACES: NameRace[] = Object.keys(NAMES) as NameRace[];

function pick<T>(arr: T[], rand: () => number = Math.random): T {
	return arr[Math.floor(rand() * arr.length)];
}

export interface GeneratedName {
	full: string;
	first: string;
	last: string;
	race: NameRace;
}

export function generateName(race?: NameRace, rand: () => number = Math.random): GeneratedName {
	const selected: NameRace = race ?? pick(NAME_RACES, rand);
	const pool = NAMES[selected];
	const first = pick(pool.first, rand);
	const last = pick(pool.last, rand);
	return { full: `${first} ${last}`, first, last, race: selected };
}

export function raceLabel(race: NameRace): string {
	return race === "half-orc" ? "Half-Orc" : race[0].toUpperCase() + race.slice(1);
}
