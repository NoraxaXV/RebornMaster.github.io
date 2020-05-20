import "./phaser.min.js";

let player;

let WIDTH;
let HEIGHT;

let DEPTHS = {
	ground: 0,
	rocks: 1,
	player: 2,
	coins: 3
}

Number.prototype.clamp = function(min, max){
	return Math.min(Math.max(this, min), max);
}



class Health {
	constructor(scene, start, max){
		this.hp = start;
		this.max = max;
		this.scene = scene;
	}
	
	add(amt){
		this.hp = (this.hp + amt).clamp(0, this.max);
		return this.hp === 0;
	}

	set(amt){
		this.hp = amt.clamp(0, this.max);
		return this.hp >= 0;
	}
}


const STATES = {
	ACTIVE: "Active",
	HURT: "Hurt",
	DEAD: "Dead"
}

class Player extends Phaser.Physics.Arcade.Sprite {
	constructor(scene, x, y){
		super(scene, x, y, "hero");
		this.name = "hero";
		scene.add.existing(this);
		scene.physics.world.enable(this);
		this.scene = scene;
		
		this.depth = DEPTHS.player;

		this.state = "Idle"
		this.body.setSize(16, 24);
		this.body.offset.y = 8;
		this.body.setBoundsRectangle(new Phaser.Geom.Rectangle(0, 0, 160, 160 - 8));

		this.Cursors = scene.input.keyboard.createCursorKeys();
		this.Space = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

		this.setCollideWorldBounds(true);
		this.setGravityY(500);

		this.speed_walk = 150;
		this.jumpForce = 300;

		// Player jumps less if space isn"t held down
		this.jumpLoss = 0.8;

		this.health = new Health(scene, 100, 100);
		this.healthBar = this.scene.add.graphics();
		this.updateHealthBar();
		
		this.points = 0;
		this.level = 1;

		this.state = STATES.ACTIVE;
	}
	
	preUpdate(time, delta){
		super.preUpdate(time, delta);

		this.getKeyState(this.Space);

		let direction = this.Cursors.right.isDown - this.Cursors.left.isDown;
		switch(this.state){
			case STATES.HURT:
				this.setVelocityX(0);
				this.anims.play("hero_hurt", true);
			break;
			case STATES.DEAD:
				this.setVelocityX(0);
				this.anims.play("hero_defeat", true);
			break;
			default:
				if (this.body.onFloor() || this.body.onWall()) {
					// Grounded
					if (this.Space.isPressed) {
						this.setVelocityY(-this.jumpForce);
						this.anims.play("hero_up", true);
						this.emit("jump");
					} else if (direction != 0) {
						this.setVelocityX(direction * this.speed_walk);
						this.anims.play("hero_walk", true);
						this.flipX = direction < 0;
					}	else {
						this.setVelocityX(0);
						if (this.anims.getCurrentKey() != "hero_idle2")
							this.anims.play("hero_idle", true);
					}
				} else {
					// Airborne
 					if (direction != 0) {
						this.setVelocityX(direction * this.speed_walk);
						this.flipX = direction < 0;
					} else
						this.setVelocityX(0);
			
					if (this.body.velocity.y > 0 && this.anims.getCurrentKey() != "hero_fall")
						this.anims.play("hero_fall", true);
					else if (this.body.velocity.y < 0 && this.Space.isUp)
						this.body.velocity.y *= this.jumpLoss;
				}

			break;
		}

	}
	
	updateHealthBar(){
		this.healthBar.clear();
		let percent = this.health.hp / this.health.max;

		// Background
		this.healthBar.fillStyle(0xff0000);
		this.healthBar.fillRect(WIDTH - 50, 1, 50, 10);

		// Bar
		this.healthBar.fillStyle(0x00ff00);
		this.healthBar.fillRect(WIDTH - 50, 1, 50*percent, 10);
	}
	
	getKeyState(key) {
  	key.isPressed = !key.previous_down && key.isDown;
    key.isReleased = key.previous_down && !key.isDown;
    key.previous_down = key.isDown;
	}

	filterCollsion(player, rock){
		
		// If "player" is a rock, then swap the parameters
		if(player.name === "rock") {
			var temp = player;
			player = rock;
			rock = temp;
		}
			
		let to = rock.getCenter().subtract(player.getCenter());
		let isAbovePlayer = to.angle() >= Math.PI;
		
		let playerDamaged = player.state === STATES.HURT || player.state === STATES.DEAD;
		
		let isRockMoving = rock.body.velocity.x === 0 && rock.body.velocity.y === 0
		
		return  isAbovePlayer && !playerDamaged && !isRockMoving;
	}

	onCollideWithRock(player, rock){
		rock.destroy();

	
		if(this.health.add(-10)){
			this.setState(STATES.DEAD);			
			this.emit("die");
		} else {
			this.setState(STATES.HURT);
			this.scene.time.addEvent({
				callback: ()=>{ this.setState(STATES.ACTIVE);},
				callbackScope: this,
				delay: 750,
				repeat: 0,
				loop: false
			});
			
		}
		this.updateHealthBar();
		this.emit("hurt", [this.health]);
	}

	onOverlapWithCoin(player, coin){
		coin.destroy();
		this.increasePoints(10, "coins");
	}
	
	increasePoints(amt, type){
		if(this.points + amt > this.level*50){
			this.increaseLevel();
		}

		this.points += amt;
		this.emit("points", this.points, type);
	}

	increaseLevel(){
		player.level++;
		this.emit("levelIncrease");
	}
}

class Boulders extends Phaser.Physics.Arcade.Group {
	constructor(scene){
		super(scene.physics.world, scene);
		scene.add.existing(this);

		this.scene = scene;

		this.runChildUpdate = true;

		this.timer = scene.time.addEvent({
			callback: this.createRock,
			callbackScope: this,
			loop: true,
			delay: 2000
		});

	}
	
	preUpdate(time, delta){
		super.preUpdate(time, delta);
	}

	
	createRock(){
		let newRock = this.create( Math.random()*WIDTH,  - 100, "rocks", Math.round(Math.random() * 3721));
		this.scene.physics.world.enable(newRock);
		newRock.depth = DEPTHS.rocks;
		newRock.name = "rock";
		newRock.scale = Math.random()*1.5+0.6;
		newRock.setCircle(8);
		
		
		newRock.body.setMass(10);
		newRock.body.setGravityY(Math.random()*50+75);
		newRock.update = function(time, delta){
			if(this.y > HEIGHT){
				newRock.destroy(); 
				player.increasePoints(1, "rocks"); 
			}
		}
	}
}

class Coins extends Phaser.Physics.Arcade.Group {
	constructor(scene){
		super(scene.physics.world, scene);
		this.scene = scene;

		scene.time.addEvent({
			callback: this.createCoin,
			callbackScope: this,
			delay: 5000,
			loop: true
		});
	}

	createCoin() {
		let leftToRight = Math.random() >= 0.5;
		let xPos = (leftToRight)? - 50: WIDTH + 50;
		let yPos = Math.random() * (HEIGHT - 20) - 20;

		let newCoin = this.create(xPos, yPos, "coins");
		newCoin.setVelocityX((leftToRight)? 20: -20 );
		newCoin.anims.play("coins_spin");
		newCoin.depth = DEPTHS.coins;
	}
}

class BootScene extends Phaser.Scene {
	constructor(){
		super({key: "BootScene"});
	}

	preload(){
		WIDTH = game.renderer.width;
		HEIGHT = game.renderer.height;
		
		this.add.text(WIDTH / 2 - 50, HEIGHT / 2 - 50, "Loading...", {color: "#000000", align: "center"});
		
		// Load images
		this.load.spritesheet("hero", "assets/adventurer.png", { frameWidth: 50, frameHeight: 37 });
		this.load.spritesheet("rocks", "assets/boulders_transparent.png", { frameWidth: 16, frameHeight: 16 });
		this.load.spritesheet("coins", "assets/coins.png", { frameWidth: 12, frameHeight: 12 });
		
		// Load audio
		this.load.audio("music", "assets/GreenAndGray.mp3");
		this.load.audio("rock_smash", "assets/rock_break.ogg");
		this.load.audio("coin_collected", "assets/coin2.wav");
		this.load.audio("jump_up", "assets/Jump_03.wav");
		this.load.audio("level_up", "assets/jingle_levelUp.wav");

		let ctx = this;
		this.load.on("progress", (percent) => { ctx.add.graphics({ fillStyle: { color: 0xffffff }}).fillRect(0, HEIGHT / 2 - 20, WIDTH * percent, 40); })
    this.load.on("complete", () => { 
			ctx.scene.start("StartScene"); 
		});

	}

	create(){
		// player animation
		game.anims.create({key:"hero_walk", defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", {start: 8, end: 13}), repeat: -1, frameRate: 10 });
		game.anims.create({key:"hero_idle", defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", { start: 0, end: 3 }),   repeat: -1, frameRate: 7 });
	  game.anims.create({key:"hero_up",  defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", { start: 77, end: 78 }),   repeat: -1, frameRate: 8  });
	  game.anims.create({key:"hero_fall", defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", { start: 22, end: 23 }),   repeat: -1, frameRate: 8  });
	  game.anims.create({key:"hero_hurt", defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", { start: 59, end: 61 }),   frameRate: 5  });
	  game.anims.create({key:"hero_defeat", defaultTextureKey: "hero", frames: game.anims.generateFrameNumbers("hero", { start: 62, end: 68 }),   duration: 3000  });

	  game.anims.create({key:"coins_spin", defaultTextureKey: "coins", frames: game.anims.generateFrameNumbers("coins", { start: 0 }),   frameRate: 10, repeat: -1  });
	}
}

class StartScene extends Phaser.Scene {
	constructor(){
		super({key: "StartScene"});
	}
	preload() {}
	create(){
		this.add.text(WIDTH / 2 - 50, HEIGHT / 2, "PRESS SPACE", {color: "#000000", align: "center"});
		this.add.text(WIDTH / 2 - 50, HEIGHT / 2 + 20, "Dodge Rocks! Get Coins!", {color: "#000000", align: "center", fontSize: "8px"});
		this.add.text(20, HEIGHT / 2 + 30, " - Move: Arrow Keys", {color: "#000000", align: "center", fontSize: "8px"});
		this.add.text(20, HEIGHT / 2 + 40, " - Jump: Space", {color: "#000000", align: "center", fontSize: "8px"});
		let ctx = this;
		this.input.keyboard.once("keydown-SPACE", ()=>{ ctx.scene.start("WorldScene"); });
	}
}

class WorldScene extends Phaser.Scene {
	constructor(){
		super({key: "WorldScene"});
	}
	preload(){}
	
	create(){
		// Set score
		let scoreText = this.add.text(10, 10, "Score: 0", { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif', color: "#0000ff", fontSize: "10px" });
	
		// Ground
		this.add.rectangle(WIDTH / 2, HEIGHT, WIDTH, 25, 0x00ff00)

		player = new Player(this, 100, 100);
		this.rocksGroup = new Boulders(this);
		this.coins = new Coins(this);

		player.on("jump", ()=>{
			this.sound.play("jump_up", {volume: 0.5});
		});

		player.on("points", (amt, type)=>{
			scoreText.setText("Score: "+amt);
			if(type === "coins") this.sound.play("coin_collected");
		});
		
		player.on("hurt", (hp)=>{
			this.cameras.main.shake(50, 0.01, false);
			this.sound.play("rock_smash");

		})
		
		player.on("die", ()=>{
			this.cameras.main.fadeOut(2750, 0, 0, 0);
			this.time.addEvent({
				callback: ()=>{ this.endGame() },
				delay: 3000,
				repeat: 0,
				loop: false
			});	
		});
		
		player.on("levelIncrease", ()=>{
			this.rocksGroup.timer.timeScale += 2;
			this.sound.play("level_up");
		});
		

		this.physics.world.addCollider(player, this.rocksGroup, player.onCollideWithRock, player.filterCollsion, player);
		this.physics.world.addOverlap(player, this.coins, player.onOverlapWithCoin, ()=>{ return true; }, player);
		
		this.sound.play("music", {loop: true, volume: 0.9});
	}

	endGame(){
		this.sound.stopAll();
		this.scene.start("GameOver");	
	}
}

class GameOver extends Phaser.Scene {
	constructor(){
		super({key: "GameOver"});
	}
	
	create(){
		this.add.text(WIDTH / 2 - 50, HEIGHT / 2, "GAME OVER", {color: "#000000", align: "center"});
		this.add.text(WIDTH / 2 - 50, HEIGHT / 2 + 50, "Sorry...press 'r' to retry", {color: "#000000", align: "center", fontSize: "8px"});
		let ctx = this;
		this.input.keyboard.on("keydown-R", ()=>{ ctx.scene.start("WorldScene"); })
	}

}

var config = {
  type: Phaser.AUTO,
  parent: "content",
  width: 160,
  height: 160,
  zoom: 3.5,
  backgroundColor: 0xfafafa,
	render: {
    pixelArt: true,
		antialias: false
  },
  physics: {
    default: "arcade",
    arcade: {
  	  debug: false,
       gravity: { y: 0 }
    }
  },
  scene: [
		BootScene,
		StartScene,
    WorldScene,
		GameOver,
  ]
};

var game = new Phaser.Game(config);


/*
game.events.once("boot", ()=>{
})
*/