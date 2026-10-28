const deployUrl = process.env.DEPLOY_URL;
const deployToken = process.env.DEPLOY_TOKEN;
const registryToken = process.env.REGISTRY_TOKEN;
const digest = process.env.DIGEST;

if (!deployUrl || !deployToken || !registryToken || !/^sha256:[a-f0-9]{64}$/.test(digest ?? "")) {
  throw new Error("La configuration privée ou le digest de l'image est incomplet.");
}

const address = new URL(deployUrl);
if (
  address.protocol !== "https:"
  || address.username
  || address.password
  || address.search
  || address.hash
  || !/^\/__deploy\/p\d{2}$/.test(address.pathname)
) {
  throw new Error("L’URL HTTPS de déploiement est invalide.");
}

const response = await fetch(address, {
  method: "POST",
  redirect: "manual",
  signal: AbortSignal.timeout(460_000),
  headers: {
    Authorization: `Bearer ${deployToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ digest, registry_token: registryToken }),
});

if (!response.ok) {
  throw new Error(`Le serveur de déploiement a répondu avec le statut HTTP ${response.status}.`);
}

const result = await response.json();
if (result.status !== "healthy") {
  throw new Error("Le serveur n’a pas confirmé que l’application est saine.");
}

console.log(`Déploiement vérifié : ${result.project} @ ${result.digest}`);
