# Modele de Securite

## Objectifs

- Integrity first: verifier les fichiers avant et pendant execution
- Defense in depth: signatures, checksums, telemetry, hardening
- Privacy by design: reports anonymes et opt-in utilisateur

## Controle d integrite

- Verification SHA-256 de chaque artifact telecharge
- Verification du manifest signe (signature serveur)
- Re-scan avant chaque lancement

## Runtime controls

- Detection de modifications non autorisees dans le dossier profil
- Detection injection DLL (Windows) cote launcher natif
- Monitoring de modules sensibles pendant l execution

## Transport

- TLS obligatoire
- Tokens courts + refresh
- Pinning certificat optionnel

## Journalisation

- Security events classes par severite
- Crash dumps anonymisables
- Consentement explicite pour envoi de rapports
