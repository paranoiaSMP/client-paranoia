import { PlayerAnimation, type PlayerObject } from "skinview3d";

/**
 * Pose de repos qui respire, plus vivante que l'IdleAnimation de skinview3d.
 *
 * <p>Celle de la bibliotheque ne balance que les bras de quelques centiemes
 * de radian: a l'ecran on ne voit pas qu'elle bouge. Ici le torse se
 * gonfle et se creuse, les epaules suivent, et la tete se leve a peine et
 * regarde parfois de cote.
 *
 * <p>Tout passe par des rotations et des echelles, jamais par des positions:
 * le modele place lui-meme chaque membre, et deplacer l'un d'eux decollerait
 * un bras du torse sur certains skins.
 */
export class BreathingAnimation extends PlayerAnimation {
	/** Rad/s de la phase: un cycle d'environ 4 secondes, un souffle calme. */
	private static readonly BREATH_RATE = 1.6;

	protected animate(player: PlayerObject): void {
		const t = this.progress;
		const breath = Math.sin(t * BreathingAnimation.BREATH_RATE);

		// Le torse s'elargit un peu plus qu'il ne monte, comme une cage
		// thoracique: monter seul ressemble a un ascenseur.
		const chest = breath * 0.018;
		player.skin.body.scale.set(1 + chest, 1 + chest * 0.6, 1 + chest * 1.4);

		// Les bras ecartes par l'inspiration, avec un decalage de phase pour que
		// le mouvement ne soit pas parfaitement symetrique.
		const armBase = Math.PI * 0.02;
		const armSwing = breath * 0.045;
		player.skin.leftArm.rotation.z = armBase + armSwing;
		player.skin.rightArm.rotation.z = -armBase - armSwing;
		player.skin.leftArm.rotation.x = Math.sin(t * 0.8 + 1.2) * 0.015;
		player.skin.rightArm.rotation.x = Math.sin(t * 0.8 + 3.4) * 0.015;

		// La tete se redresse a l'inspiration, et derive tres lentement de cote.
		player.skin.head.rotation.x = -breath * 0.025;
		player.skin.head.rotation.y = Math.sin(t * 0.35) * 0.12;

		// Les jambes ne bougent pas: un personnage qui respire ne marche pas.
		player.skin.leftLeg.rotation.x = 0;
		player.skin.rightLeg.rotation.x = 0;

		const capeBase = Math.PI * 0.06;
		player.cape.rotation.x = capeBase + Math.sin(t * BreathingAnimation.BREATH_RATE - 0.6) * 0.02;
	}
}
