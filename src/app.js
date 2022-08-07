// Bindings

/**
 * Binding to `Date.now`. Saves 3 characters with 2 references.
 */
let now = Date.now;

/** Binding to `window.Math` */
let math = Math;
let sign = math.sign;
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

/** A pixel in the level will be this many pixels on the game canvas. */
let levelScale = 30;

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
let x = { v: 39 * levelScale };

/**
 * The vertical coordinate of the dragon in pixels. Greater numbers are downward.
 * @type {Interpolation}
 */
//let y = { v: 59 * levelScale };
let y = { v: 0 * levelScale };

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

	// Draw level
	graphics.globalAlpha = 0.7;
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

		let currentLevelX = (x.v / levelScale) | 0;
		let currentLevelY = (y.v / levelScale) | 0;
		let previousLevelX = (x.p / levelScale) | 0;
		let previousLevelY = (y.p / levelScale) | 0;
		let xDirection = sign(x.v - x.p);
		let yDirection = sign(y.v - y.p);
		let velocityDirection = math.atan2(ySpeed * facing, xSpeed * facing);
		let speed = math.sqrt(xSpeed * xSpeed + ySpeed * ySpeed) * facing;
		let touching = getPixel(currentLevelX, currentLevelY);
		let index = 0;
		// Play music
		if ((isPressed || !touching) && !((tickCount = ++tickCount % (tempo * spriteSheetHeight)) % tempo)) {
			while (index < 5 - y.v / (levelScale * spriteSheetHeight / 4)) {
				playSound(
					[0, 139, 147, 185][getPixel(audioOffset + index, (tickCount / tempo) | 0) & 3] * index++,
				);
			}
		}

		// Determine flight behavior based on control input and angle of attack
		if (isPressed && math.abs(angleDifference(direction.v, velocityDirection)) < 0.5) {
			// Pitch up
			direction.v -= facing * 0.14;

			// Match velocity direction with pointing direction.
			ySpeed = math.sin(direction.v) * speed;
			xSpeed = math.cos(direction.v) * speed;
		} else {
			// Pitch to direction of travel
			direction.v = direction.v + angleDifference(direction.v, velocityDirection) * 0.2;
		}

		// Flip to face direction of travel
		if ((touching || !isPressed) && (sign(xSpeed) || facing) != facing) {
			facing *= -1;
			direction.v += pi;
			direction.p += pi;
		}

		// Flying animation
		frame = frame < frameFlying2 ? frameFlying2 : frameFlying1;

		// Collision physics
		if (touching) {
			x.v = x.p;
			y.v = y.p;

			// Horizontal collision check
			if (!getPixel(previousLevelX - xDirection, currentLevelY)) {
				// Bounce off wall
				xSpeed = math.abs(xSpeed) * xDirection * -0.3;
			}

			// Vertical collision check
			if (!getPixel(currentLevelX, previousLevelY - yDirection)) {
				// Snap to floor or ceiling
				y.v = (currentLevelY + (yDirection > 0 ? 0 : 1)) * levelScale;
				// Bounce off floor or ceiling
				ySpeed = math.abs(ySpeed) * (yDirection || 1) * -0.3;
				// Boost
				if (isPressed && ySpeed <= 0) {
					playSound(220);
					ySpeed -= 4;
					xSpeed += facing;
				}
			}
			if (isPressed) {
				// If touching ground, point towards the velocity vector
				direction.v = velocityDirection;
			} else {
				if (math.abs(speed) < 2) {
					// Stand still
					direction.v = frame = xSpeed = ySpeed = 0;
				} else {
					// Slow down
					xSpeed *= 0.7;
				}
			}
		}

		// Adjust direction interpolation to prevent jank.
		direction.p = direction.v + angleDifference(direction.v, direction.p);

		// Reset game if dragon goes out of bounds.
		if (y.v > (spriteSheetHeight + 1) * levelScale) {
			x.v = y.v = xSpeed = ySpeed = 0;
		}
	}, millisecondsPerTick);

	// Start render loop
	render();
}