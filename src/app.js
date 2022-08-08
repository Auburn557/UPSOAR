// Bindings

/**
 * Binding to `Date.now`. Saves 3 characters with 2 references.
 */
let now = Date.now;

/** Binding to `window.Math` */
let math = Math;
let sign = math.sign;
let abs = math.abs;
let pi = math.PI;
let twoPi = pi * 2;

/** The canvas used for displaying the game and retreiving sprite data. */
let canvas = /** @type {HTMLCanvasElement} */(document.getElementById(/** @type {*} */(0)));
let graphics = canvas.getContext("2d");

/**
 * Retreives the red value for the pixel at the given coordinate in the sprite sheet.
 * @param {number} x 
 * @param {number} y 
 * @returns {number}
 */
let getPixel = (x, y) => spriteSheetData[x * 4 + y * spriteSheetWidth * 4];


/** The gap in millisends between executions of the main game loop. */
let millisecondsPerTick = 50;

/**
 * The time of the last execution of the game loop.
 * @type {number}
 */
let lastTick;

/**
 * A representation of an interpolation between two different values in time.
 * @typedef {Object} Interpolation
 * @property {number} v The current value.
 * @property {number=} p The previous value.
 */

/**
 * @param {Interpolation} interpolation 
 */
let interpolate = interpolation =>
	interpolation.p +
	(interpolation.v - interpolation.p) *
	(now() - lastTick) / millisecondsPerTick;

/**
 * Returns the signed difference between two angles.
 * @param {number} sourceAngle 
 * @param {number} targetAngle 
 * @returns {number}
 */
let angleDifference = (sourceAngle, targetAngle) =>
	((targetAngle - sourceAngle + pi) % twoPi + twoPi) % twoPi - pi;

// Sprite sheet layout information.

let spriteSheetWidth = 60;
let spriteSheetHeight = 60;
let dragonWidth = 27;
let dragonHeight = 20;
let dragonOffsetX = -16;
let dragonOffsetY = -12;
let frameStanding = 0;
let frameFlying1 = dragonHeight;
let frameFlying2 = dragonHeight * 2;
let screenXOffset = 150;
let screenYOffset = 75;
let backgroundX = -23;

/** A pixel in the level will be this many pixels on the game canvas. */
let levelScale = 30;

/** A pixel in the background will be this many pixels wide on the game canvas. */
let backgroundXScale = 120;

/** A pixel in the background will be this many pixels tall on the game canvas. */
let backgroundYScale = 60;

/** The amount of parallax to apply to the background. Values closer to 0 apply more parallax. */
let backgroundParallax = 0.5;

/**
 * The singular control for the game. `0` and `undefined` are released, `1` is pressed.
 * Clicking, tapping, or pressing a key will active this control.
 * @type {1 | 0 | undefined}
 */
let isPressed;

/** The direction the character is facing. 1 is right, -1 is left. */
let facing = 1;

/**
 * The horizontal coordinate of the dragon in pixels. Greater numbers are to the right.
 * @type {Interpolation}
 */
let x = { v: 39.9 * levelScale };

/**
 * The vertical coordinate of the dragon in pixels. Greater numbers are downward.
 * @type {Interpolation}
 */
let y = { v: 54 * levelScale };

/**
 * The horizontal component of the dragon's velocity. Greater numbers are to the right.
 */
let xSpeed = 0;

/**
 * The vertical component of the dragon's velocity. Greater numbers are downward.
 */
let ySpeed = 0;

/**
 * The angle the dragon is pointing down in radians.
 * @type {Interpolation}
 */
let direction = { v: 0 };
let frame = 0;

// Audio
let tickCount = -1;
let tempo = 5;
let audio = new AudioContext();
let audioOffset = 27;

// Win animation

/**
 * The current win condition. `0` is not won yet, `1` is currently playing win animation, and `2`
 * is win animation complete.
 * @type {0 | 1 | 2}
 */
let winState = 0;
let winX = 37.5 * levelScale;
let winY = 3 * levelScale;

/**
 * 
 * @param {number} frequency
 */
let playSound = (frequency) => {
	if (frequency) {
		let time = audio.currentTime;
		let gainNode = audio.createGain();
		let gainParam = gainNode.gain;
		let oscillator = audio.createOscillator();
		let endTime = time + 1;
		gainNode.connect(audio.destination);
		gainParam.value = 0.1;
		gainParam.exponentialRampToValueAtTime(0.01, endTime);
		oscillator.type = "triangle";
		oscillator.frequency.value = frequency;
		oscillator.connect(gainNode)
		oscillator.start();
		oscillator.stop(endTime);
		oscillator.onended = _ => gainNode.disconnect();
		audio.resume();
	}
}

// Rendering loop. The client controls how often this runs.
let render = _ => {
	graphics.resetTransform();

	// Clear the screen
	graphics.fillRect(0, 0, 300, 150);

	// Draw background
	graphics.globalAlpha = 0.2;
	graphics.drawImage(
		spriteSheet, // image to draw
		(backgroundX * backgroundXScale) - interpolate(x) * backgroundParallax, // destination x
		-interpolate(y) * backgroundParallax, // destination y
		spriteSheetWidth * backgroundXScale, // destination width
		spriteSheetHeight * backgroundYScale // destination height
	);

	// Draw level
	graphics.globalAlpha = 0.8;
	graphics.drawImage(
		spriteSheet, // image to draw
		screenXOffset - interpolate(x), // destination x
		screenYOffset - interpolate(y), // destination y
		spriteSheetWidth * levelScale, // destination width
		spriteSheetHeight * levelScale // destination height
	);

	// Draw dragon
	graphics.globalAlpha = 1;
	graphics.translate(screenXOffset, screenYOffset - 7);
	graphics.rotate(interpolate(direction));
	graphics.scale(facing, 1);
	graphics.drawImage(
		spriteSheet, // image to draw
		0, // source x
		frame, // source y
		dragonWidth, // source width
		dragonHeight - 1, // source height
		dragonOffsetX, // destination x
		dragonOffsetY, // destination y
		dragonWidth, // destination width
		dragonHeight - 1 // destination height
	);

	// Continue render loop
	requestAnimationFrame(render);
}

let spriteSheet = new Image();

/**
 * The pixel data of the sprite sheet
 * @type {Uint8ClampedArray}
 */
let spriteSheetData;

// Load the image
spriteSheet.src = URL.createObjectURL(
	new Blob([
		new Uint16Array(/** @type {*} */("{SPRITE_URL}".match(/.{5}/g)))
	])
);
spriteSheet.onload = _ => {
	// Retrieve pixels from image
	graphics.drawImage(spriteSheet, 0, 0);
	spriteSheetData = graphics
		.getImageData(0, 0, spriteSheetWidth, spriteSheetHeight)
		.data;

	// Control input
	onkeydown = onpointerdown = /** @type {(event: *) => *} */(_ => isPressed = 1);
	onkeyup = onpointerup = /** @type {(event: *) => *} */(_ => isPressed = 0);

	// Set sky color
	graphics.fillStyle = "#112";

	// Set canvas to use nearest neighbor scaling
	graphics.imageSmoothingEnabled = /** @type {*} */(0);

	// Main game loop. Runs at a fixed interval.
	setInterval(_ => {
		// Reset interpolation
		lastTick = now();
		x.p = x.v;
		y.p = y.v;
		direction.p = direction.v;

		// Apply velocity
		y.v += ySpeed;
		x.v += xSpeed;

		// Apply gravity
		ySpeed += 0.5;

		let currentLevelY = (y.v / levelScale) | 0;
		let xDirection = sign(x.v - x.p);
		let yDirection = sign(y.v - y.p);
		let velocityDirection = math.atan2(ySpeed * facing, xSpeed * facing);
		let speed = (math.sqrt(xSpeed * xSpeed + ySpeed * ySpeed) + 0.1) * facing;
		let touching = getPixel((x.v / levelScale) | 0, currentLevelY);
		let index = 0;
		// Play music
		if (
			(frame || winState == 1) &&
			!((tickCount = ++tickCount % (tempo * spriteSheetHeight)) % tempo)
		) {
			while (index < 5 - y.v / (levelScale * spriteSheetHeight / 4)) {
				playSound(
					[0, 139, 147, 185][getPixel(audioOffset + index, (tickCount / tempo) | 0) & 3] *
					index++ *
					(winState == 1 ? 2 : 1),
				);
			}
		}

		if (winState != 1) {
			// Determine flight behavior based on control input and angle of attack
			if (isPressed && abs(angleDifference(direction.v, velocityDirection)) < 0.5) {
				// Pitch up
				direction.v -= facing * 0.2;

				// Match velocity direction with pointing direction.
				ySpeed = math.sin(direction.v) * speed;
				xSpeed = math.cos(direction.v) * speed;
			} else {
				// Pitch to direction of travel
				direction.v = direction.v + angleDifference(direction.v, velocityDirection) * 0.3;
			}

			// Flip to face direction of travel
			if ((!isPressed || touching) && (sign(xSpeed) || facing) != facing) {
				facing *= -1;
				direction.v += pi;
				direction.p += pi;
			}

			// Flying animation
			frame = frame < frameFlying2 ? frameFlying2 : frameFlying1;

			// Collision physics
			if (touching) {
				// Move to previous location to prevent clipping through
				x.v = x.p;
				y.v = y.p;

				// Bounce
				xSpeed = isPressed ? abs(xSpeed) * xDirection * -0.5 : 0;
				ySpeed = abs(ySpeed) * yDirection * -0.1

				// Point towards the velocity vector.
				direction.v = velocityDirection;

				if (isPressed) {
					if (ySpeed <= 0) {
						// Jump
						playSound(220);
						ySpeed = -6;
						xSpeed = facing * 2;
					}
				} else {
					if (abs(speed) < 2 && ySpeed <= 0) {
						// Stand still
						direction.v = frame = xSpeed = ySpeed = 0;
						y.v = currentLevelY * levelScale;
					}
				}
			}

			// Adjust direction interpolation to prevent jank.
			direction.p = direction.v + angleDifference(direction.v, direction.p);

			// Start win animation
			if (!winState && x.v < winX && y.v < winY) {
				winState = 1;
				tickCount = 48 * tempo - 1;
			}
		} else {
			// Play win animation
			xSpeed = ySpeed = direction.v = 0;
			x.v = winX;
			y.v = winY;
			frame = ((tickCount % tempo) / (tempo / 2)) | 0 ? frameStanding : frameFlying1;
			facing = ((tickCount % (tempo * 2)) / tempo) | 0 ? -1 : 1;

			if (!tickCount) {
				winState = 2;
			}
		}

		// Reset game if dragon goes out of bounds.
		if (y.v > (spriteSheetHeight + 1) * levelScale) {
			x.v = y.v = xSpeed = ySpeed = 0;
		}
	}, millisecondsPerTick);

	// Start render loop
	render();
}