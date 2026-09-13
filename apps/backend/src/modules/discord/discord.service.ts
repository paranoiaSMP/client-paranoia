import { Client } from 'discord-rpc';
import pino from 'pino';

const logger = pino({ level: 'info' });
const clientId = '1535262183020175412';

let rpc: Client | null = null;
let isConnected = false;

export function setIdlePresence() {
  if (!rpc || !isConnected) return;
  
  rpc.setActivity({
    details: 'Dans le launcher',
    state: 'Prêt à jouer',
    largeImageKey: 'logo',
    largeImageText: 'Paranoia SMP',
    instance: false,
  }).catch((err) => console.error("Erreur RPC:", err));
}

export function setPlayingPresence(version: string, username: string) {
  if (!rpc || !isConnected) return;

  rpc.setActivity({
    details: 'Joue sur Paranoia SMP',
    state: `Pseudo: ${username}`,
    largeImageKey: 'logo',
    // La version arrivait jusqu'ici depuis le lancement, puis etait jetee: le
    // parametre existait, personne ne le lisait. L'infobulle repetait
    // « Paranoia SMP », deja affiche juste au-dessus.
    largeImageText: `Paranoia SMP — Minecraft ${version}`,
    startTimestamp: new Date(),
    instance: false,
  }).catch((err) => console.error("Erreur RPC:", err));
}

export async function initDiscordRPC() {
  rpc = new Client({ transport: 'ipc' });
  
  rpc.on('ready', () => {
    logger.info('Discord RPC connecté avec succès !');
    isConnected = true;
    setIdlePresence(); // Maintenant rpc n'est plus nul quand ça s'exécute !
  });

  try {
    await rpc.login({ clientId });
  } catch (err) {
    logger.warn('Discord n\'est pas lancé ou injoignable.');
  }
}