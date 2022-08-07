import { minify } from "terser";
import { Buffer } from "buffer";
//@ts-expect-error Can't resolve stream
import { Readable } from "stream";
//@ts-expect-error Can't resolve fs
import fs from "fs/promises";
import OptiPng from "optipng";
import QRCode from "qrcode";

console.log("Building app...");

const appMinified = async function () {
	return (await minify(
		await (await fs.readFile("./src/app.js")).toString("utf-8"),
		{
			toplevel: true,
			compress: {
				comparisons: true,
				toplevel: true,
				unsafe: true,
				unsafe_math: true,
				unsafe_comps: true
			},
			format: {
				quote_style: 1,
				ascii_only: true
			}
		}
	)).code;
}();

/**
 * 
 * @param {Buffer} buffer 
 * @returns {Promise<Buffer>}
 */
function optimizePNG(buffer) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		Readable.from(buffer).pipe(new OptiPng(["-o7"]))
			.on("data", data => chunks.push(data))
			.on("end", () => resolve(Buffer.concat(chunks)))
			.on("error", error => reject(error))
	});
}

const spriteSheetURL = async function () {
	const png = await fs.readFile("./src/sprite-sheet.png");
	const crunchedPng = await optimizePNG(png);
	if (crunchedPng.length % 2 !== 0) {
		throw new Error(
			"The size of the sprite sheet is not divisible by 2: " + crunchedPng.length
		);
	}
	const hextets = [];
	for (let i = 0; i < crunchedPng.length;) {
		hextets.push(crunchedPng[i++] | (crunchedPng[i++] << 8));
	}
	return hextets.map(hextet => hextet.toString().padStart(5, "0")).join("");
}();

/**
 * 
 * @param {string} url 
 */
function escapeURL(url) {
	let result = "";
	let index = 0;
	const regex = /[^0-9A-Za-z-_.~!*'();:@&=+$,\/?[\]]/g;
	let match;
	while (match = regex.exec(url)) {
		const character = match[0];
		const replacement = "%" + character
			.charCodeAt(0)
			.toString(16)
			.toUpperCase()
			.padStart(2, "0");
		result += url.substring(index, match.index);
		result += replacement;
		index = match.index + 1;
	}
	return result;
}

const appHTML =
	"<META NAME=VIEWPORT CONTENT=WIDTH=DEVICE-WIDTH>" +
	"<TITLE>UPSOAR</TITLE>" +
	"<BODY STYLE=BACKGROUND-COLOR:#000>" +
	"<CANVAS ID=0 STYLE=" +
	"WIDTH:100%;" +
	"MAX-WIDTH:200VMIN;" +
	"POSITION:FIXED;" +
	"TOP:0;" +
	"BOTTOM:0;" +
	"LEFT:0;" +
	"RIGHT:0;" +
	"MARGIN:AUTO;" +
	"IMAGE-RENDERING:PIXELATED" +
	">" +
	"<SCRIPT>" +
	(await appMinified).replace("{SPRITE_URL}", await spriteSheetURL) +
	"</SCRIPT>";

const HTMLFile = fs.writeFile("app.html", appHTML, "utf8");
const appURL = "DATA:TEXT/HTML;-PASTE-IN-WEB-BROWSER-," + escapeURL(appHTML);
const URLFile = fs.writeFile("app-url.txt", appURL, "utf8");
const qrCode = QRCode.create(appURL, { errorCorrectionLevel: "L" });
/** The maximum number of bits a QR Code can possibly store. */
const version40Bits = 23648;
/** The number of bits used to encode the mode of a QR code segment. */
const modeOverhead = 4;
/**
 * @type {Record<string, {
 *		bitNumerator: number,
 * 		bitDenominator: number,
 * 		overhead: [number, number, number]
 * }>}
 */
const segmentInfo = {
	Numeric: {
		bitNumerator: 10,
		bitDenominator: 3,
		overhead: [10, 12, 14]
	},
	Alphanumeric: {
		bitNumerator: 10,
		bitDenominator: 2,
		overhead: [9, 11, 13]
	},
	Byte: {
		bitNumerator: 8,
		bitDenominator: 1,
		overhead: [8, 16, 16]
	},
	Kanji: {
		bitNumerator: 13,
		bitDenominator: 1,
		overhead: [8, 10, 12]
	}
}
const versionOverheadIndex = qrCode.version <= 9 ? 0 : (qrCode.version <= 26 ? 1 : 2);
const bits = qrCode
	.segments
	.map(segment => {
		const info = segmentInfo[segment.mode.id];
		if (!info) { throw new Error("Unknown mode: " + segment.mode.id); }
		return (
			modeOverhead +
			info.overhead[versionOverheadIndex] +
			Math.ceil((info.bitNumerator * segment.data.length) / info.bitDenominator)
		);
	})
	.reduce((sum, current) => sum + current, 0);
const qrCodeFile = async function () {
	const qrCodePNG = await optimizePNG(await QRCode.toBuffer(qrCode.segments, {
		errorCorrectionLevel: "L",
		margin: 4,
		scale: 1
	}));
	await fs.writeFile("app-qr-code.png", qrCodePNG, "binary")
}();

const report = JSON.stringify({
	qrVersion: qrCode.version,
	segments: qrCode.segments.map(segment => [segment.mode.id, segment.data.length]),
	used: bits +
		" of " +
		version40Bits +
		" (" +
		(bits * 100 / version40Bits).toFixed(3) +
		"%) bits",
	bytesLeft: (version40Bits - bits) / 8,
	dataURL: appURL
}, undefined, "\t");
const reportFile = fs.writeFile("app-report.json", report, "utf8");

await HTMLFile;
await URLFile;
await qrCodeFile;
await reportFile;

console.log(report);
