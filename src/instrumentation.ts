/// Lancé une fois au démarrage du serveur. Les serveurs d'hébergement tournent en heure UTC : sans ce réglage, « le prochain
/// service », les créneaux de réservation et les horaires du planning seraient décalés d'une à deux heures par rapport à
/// la Belgique. On force donc le fuseau de l'appli (modifiable avec la variable APP_TIMEZONE).
export async function register() {
  process.env.TZ = process.env.APP_TIMEZONE || "Europe/Brussels";
}
