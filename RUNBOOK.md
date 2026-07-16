# Runbook d'exploitation

Ce document sert de guide rapide pour diagnostiquer l'application, prouver la résilience et démontrer le HPA.

## 1. Vérifications de base

```bash
kubectl get all -n projet-final
kubectl get pods -n projet-final -o wide
kubectl get svc -n projet-final
kubectl get ingress -n projet-final
kubectl get hpa -n projet-final
```

Screenshots utiles:

- sortie de `kubectl get all -n projet-final`
- sortie de `kubectl get ingress -n projet-final`
- sortie de `kubectl get hpa -n projet-final`

## 1bis. Bootstrap du VPS ARM64

Exemple avec Ubuntu sur le VPS et `k3s` comme cluster Kubernetes léger.

```bash
sudo apt update
sudo apt install -y curl git ca-certificates gnupg
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
sudo kubectl get pods -A
```

Installer un Ingress Nginx:

```bash
sudo kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
sudo kubectl get pods -n ingress-nginx
```

⚠️ Nos `NetworkPolicy` (`k8s/security/networkpolicies.yaml`) n'autorisent le trafic entrant vers
frontend/APIs/prometheus/grafana que depuis un namespace labellisé
`kubernetes.io/metadata.name: ingress-nginx`. Le manifest officiel ci-dessus crée bien un
namespace `ingress-nginx`, et Kubernetes labellise automatiquement tout namespace avec son propre
nom depuis la 1.21 — donc ça marche tel quel avec ce manifest. Si vous changez d'installation
(Helm, autre namespace...), il faudra adapter le `namespaceSelector` dans ce fichier, sinon le
frontend et les APIs deviennent injoignables depuis l'extérieur.

Installer metrics-server pour l'HPA:

```bash
sudo kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
sudo kubectl -n kube-system rollout status deploy/metrics-server
```

Ouvrir les ports nécessaires si un pare-feu est actif:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 6443/tcp
sudo ufw enable
sudo ufw status
```

Récupérer le kubeconfig du VPS:

```bash
sudo cat /etc/rancher/k3s/k3s.yaml
```

Si GitHub Actions doit déployer dessus, encoder le kubeconfig en base64 et le mettre dans le secret GitHub `KUBE_CONFIG_DATA`:

```bash
base64 -w 0 /etc/rancher/k3s/k3s.yaml
```

Pour tester le host de l'Ingress depuis le PC, ajouter un mapping local:

```bash
echo "IP_DU_VPS app.local" | sudo tee -a /etc/hosts
```

## 2. Logs et diagnostic

```bash
kubectl logs deploy/frontend -n projet-final
kubectl logs deploy/api-catalogue -n projet-final
kubectl logs deploy/api-orders -n projet-final
kubectl describe pod <pod-name> -n projet-final
kubectl describe deploy api-orders -n projet-final
```

Les deux APIs logguent chaque requête HTTP en JSON structuré (`method`, `path`, `status`,
`duration_ms`, `ts`) sur stdout, sauf `/healthz` (bruit de la liveness probe). Pratique avec `jq`:

```bash
kubectl logs deploy/api-orders -n projet-final --tail=50 | jq -r 'select(.msg=="request") | "\(.status) \(.method) \(.path) \(.duration_ms)ms"'
```

À screen:

- `kubectl logs` sur une API
- `kubectl describe pod` si un pod est en erreur

Commandes utiles sur le VPS:

```bash
sudo kubectl get pods -n projet-final -o wide
sudo kubectl logs deploy/api-orders -n projet-final
sudo kubectl describe pod <pod-name> -n projet-final
```

## 3. Rollout et rollback

Ces commandes servent à prouver que les déploiements sont pilotables: suivre une mise à jour en
cours, consulter l'historique des révisions, revenir en arrière en cas de problème, ou forcer un
redémarrage complet des pods sans changer l'image.

```bash
kubectl rollout status deploy/api-orders -n projet-final
kubectl rollout history deploy/api-orders -n projet-final
kubectl rollout undo deploy/api-orders -n projet-final
kubectl rollout restart deploy/api-orders -n projet-final
```

- `rollout status`: attend et affiche la progression d'un déploiement (à lancer juste après un
  `kubectl apply` ou un changement d'image) pour vérifier que le rolling update se termine bien
  sans rester bloqué.
- `rollout history`: liste les révisions précédentes du déploiement (numéro de révision, cause du
  changement), pour savoir vers quelle version revenir.
- `rollout undo`: revient à la révision précédente (ou à une révision précise avec
  `--to-revision=N`) — démontre qu'un rollback est possible en cas de mise en prod défaillante.
- `rollout restart`: redémarre tous les pods du déploiement un par un (rolling restart) sans
  changer l'image; utile pour recharger une config/un secret modifié, ou pour la démo de
  résilience de la section 4.

À screen:

- `kubectl rollout status deploy/api-orders -n projet-final`: montre le déploiement se terminer
  avec succès (`successfully rolled out`).
- `kubectl rollout undo deploy/api-orders -n projet-final`: montre le retour effectif à la
  révision précédente (à confirmer avec un nouveau `kubectl rollout status` ou `kubectl get pods`).

## 4. Preuve de résilience

Scenario : tuer un pod et montrer que Kubernetes le recrée.

```bash
kubectl get pods -n projet-final
kubectl delete pod <pod-name> -n projet-final
kubectl get pods -n projet-final -w
kubectl logs deploy/api-orders -n projet-final
```

Version à exécuter sur le VPS:

```bash
sudo kubectl get pods -n projet-final
sudo kubectl delete pod <pod-name> -n projet-final
sudo kubectl get pods -n projet-final -w
sudo kubectl logs deploy/api-orders -n projet-final
```

Ce qu'il faut capturer:

- le pod avant suppression
- la commande `kubectl delete pod <pod-name> -n projet-final`
- la recréation automatique du pod avec `kubectl get pods -w`
- un appel fonctionnel vers l'application après redémarrage

Variante plus démonstrative :

```bash
kubectl rollout restart deploy/frontend -n projet-final
kubectl get pods -n projet-final -w
```

## 5. Preuve HPA

Prérequis: `metrics-server` doit être installé sur le cluster.

```bash
kubectl get hpa -n projet-final
kubectl describe hpa api-orders-hpa -n projet-final
kubectl top pods -n projet-final
```

Version à exécuter sur le VPS:

```bash
sudo kubectl get hpa -n projet-final
sudo kubectl describe hpa api-orders-hpa -n projet-final
sudo kubectl top pods -n projet-final
```

Pour générer de la charge, il est possible de lancer une charge simple depuis un pod temporaire ou depuis ta machine si l'Ingress est accessible.

Exemple local:

```bash
while true; do curl -s -X POST http://app.local/api/orders -H 'Content-Type: application/json' -d '{"item":"test"}' >/dev/null; done
```

Ce qu'il faut screen:

- `kubectl get hpa -n projet-final` avant charge
- `kubectl describe hpa api-orders-hpa -n projet-final` pendant charge
- `kubectl top pods -n projet-final` montrant l'augmentation éventuelle
- un éventuel changement du nombre de replicas dans les pods

Si l'autoscaling ne monte pas, les causes possibles pourraient être :

- `metrics-server` absent ou non fonctionnel
- charge insuffisante
- seuil CPU trop élevé

## 6. Base de données

```bash
kubectl get statefulset -n projet-final
kubectl get pvc -n projet-final
kubectl logs statefulset/postgres -n projet-final
```

À screen:

- le `StatefulSet`
- le PVC associé

## 7. Backup et restore de la base

Backup ponctuel via `pg_dump` dans le pod (commande uniquement pour la démo. En production on utiliserait un CronJob planifié par exemple):

```bash
kubectl exec -n projet-final statefulset/postgres -- pg_dump -U user -d appdb > backup-$(date +%Y%m%d-%H%M).sql
```

Restore à partir d'un dump (écrase les données existantes en cas de conflit d'ID):

```bash
kubectl exec -i -n projet-final statefulset/postgres -- psql -U user -d appdb < backup-20260715-1200.sql
```

Vérifier après restore:

```bash
kubectl exec -n projet-final statefulset/postgres -- psql -U user -d appdb -c "SELECT count(*) FROM orders;"
```

## 8. Scale manuel

```bash
kubectl scale deployment frontend -n projet-final --replicas=3
kubectl scale deployment api-catalogue -n projet-final --replicas=3
kubectl get pods -n projet-final -l app=frontend -w
```

⚠️ `api-orders` a un HPA actif: un `kubectl scale` dessus est temporaire, le HPA va recalculer et
réajuster le nombre de replicas au prochain cycle selon le CPU observé. Pour changer durablement
son plancher, modifiez le HPA lui-même:

```bash
kubectl patch hpa api-orders-hpa -n projet-final --patch '{"spec":{"minReplicas":3}}'
```

## 9. Sécurité (RBAC / NetworkPolicy)

Vérifier que les ServiceAccounts dédiés existent et sont bien utilisés par les pods:

```bash
kubectl get sa -n projet-final
kubectl get pod -n projet-final -o custom-columns=NAME:.metadata.name,SA:.spec.serviceAccountName
```

Prouver le RBAC least-privilege sans avoir besoin d'un token monté dans un pod (fonctionne par
impersonation depuis un kubeconfig admin):

```bash
kubectl auth can-i get configmaps -n projet-final --as=system:serviceaccount:projet-final:app-sa
kubectl auth can-i delete pods -n projet-final --as=system:serviceaccount:projet-final:app-sa
```

Le premier doit répondre `yes`, le second `no` (le Role `app-readonly` n'autorise que get/list/watch).

Vérifier les NetworkPolicy en place et tester un flux qui doit être refusé (ex: un pod quelconque
qui tente de joindre postgres directement, hors api-catalogue/api-orders):

```bash
kubectl get networkpolicy -n projet-final
kubectl run netpol-test --rm -it --image=busybox -n projet-final --restart=Never -- \
  nc -zvw3 postgres-service 5432
```

Cette dernière commande doit échouer ("timed out", pas "refused" — le paquet est silencieusement
droppé, pas rejeté), ce qui prouve que `allow-postgres-from-apis` bloque bien tout pod qui n'est
pas `api-catalogue`/`api-orders`.

Idem côté egress: prouver que le default-deny-egress bloque bien les sorties non autorisées
(ex: un pod quelconque qui tente de joindre Internet), sauf la résolution DNS qui reste toujours
autorisée:

```bash
kubectl run netpol-egress-test --rm -it --image=busybox -n projet-final --restart=Never -- \
  sh -c "nslookup postgres-service && nc -zvw3 8.8.8.8 443"
```

Le `nslookup` doit réussir (règle `allow-dns-egress`), le `nc` vers Internet doit timeout
(`default-deny-egress` sans règle egress correspondante).

## 10. Observabilité (Prometheus / Grafana)

```bash
kubectl port-forward svc/prometheus-service -n projet-final 9090:9090
```

Puis ouvrir `http://localhost:9090/targets`: `api-catalogue` et `api-orders` doivent apparaître
`UP` (scrape via leurs annotations `prometheus.io/*` et leur endpoint `/metrics`).

En plus des métriques runtime par défaut de `prom-client` (heap, event loop...), les deux APIs
exposent des métriques applicatives utiles pour la démo HPA, à tester dans `/graph`. Attention: le
label de namespace posé par le `relabel_configs` de `prometheus.yaml` s'appelle
`kubernetes_namespace`, pas `namespace`:

```
rate(http_requests_total{kubernetes_namespace="projet-final"}[1m])
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{kubernetes_namespace="projet-final"}[5m]))
```

Un dashboard **"API Overview - projet-final"** est provisionné automatiquement au démarrage de
Grafana (ConfigMaps `grafana-dashboards-provider` + `grafana-dashboards` dans
`k8s/monitoring/grafana.yaml`) — pas besoin de créer un panel à la main. Il apparaît directement
dans la liste des dashboards après le déploiement, avec 4 panels: requêtes/sec par service,
latence p95 par service, taux d'erreurs 5xx par service, pods up. Si tu ne le vois pas après un
`kubectl apply`, c'est probablement que le pod Grafana existait déjà avant ce changement — un
`kubectl rollout restart deploy/grafana -n projet-final` force la relecture des ConfigMaps de
provisioning (le pod ne les relit qu'au démarrage, pas à chaud).

La première montre le débit de requêtes pendant la génération de charge, la seconde la latence
p95 — plus parlant que le CPU seul pour justifier le scale du HPA.

```bash
kubectl port-forward svc/grafana-service -n projet-final 3000:3000
```

Puis ouvrir `http://localhost:3000` (login `admin` / mot de passe du secret `grafana-secret`) —
la datasource Prometheus est provisionnée automatiquement, pas besoin de la configurer à la main.

À screen:

- la page `/targets` de Prometheus avec les deux APIs `UP`
- un graphe Grafana simple (ex: `up{namespace="projet-final"}`)

## 11. Checklist de démo

1. `kubectl get all -n projet-final`
2. accès au frontend via l'Ingress
3. test de `api-catalogue` et `api-orders`
4. suppression d'un pod et recréation automatique
5. affichage du HPA avant et pendant charge
6. `kubectl rollout undo` sur une API
7. `kubectl scale` manuel sur `frontend` ou `api-catalogue`
8. backup + restore rapide de la base
9. `kubectl auth can-i` pour prouver le RBAC least-privilege
10. dashboard Grafana ou page `/targets` Prometheus
