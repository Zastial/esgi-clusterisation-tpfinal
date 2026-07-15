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

Pour tester le host de l'Ingress depuis ton PC, ajoute un mapping local:

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

```bash
kubectl rollout status deploy/api-orders -n projet-final
kubectl rollout history deploy/api-orders -n projet-final
kubectl rollout undo deploy/api-orders -n projet-final
kubectl rollout restart deploy/api-orders -n projet-final
```

À screen:

- `kubectl rollout status deploy/api-orders -n projet-final`
- `kubectl rollout undo deploy/api-orders -n projet-final`

## 4. Preuve de résilience

Scenario conseillé: tuer un pod et montrer que Kubernetes le recrée.

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

Variante plus démonstrative si tu as le temps:

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

Pour générer de la charge, tu peux lancer une charge simple depuis un pod temporaire ou depuis ta machine si l'Ingress est accessible.

Exemple local:

```bash
while true; do curl -s -X POST http://app.local/api/orders -H 'Content-Type: application/json' -d '{"item":"test"}' >/dev/null; done
```

Ce qu'il faut screen:

- `kubectl get hpa -n projet-final` avant charge
- `kubectl describe hpa api-orders-hpa -n projet-final` pendant charge
- `kubectl top pods -n projet-final` montrant l'augmentation éventuelle
- un éventuel changement du nombre de replicas dans les pods

Si l'autoscaling ne monte pas, mentionner clairement en soutenance les causes possibles:

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

## 7. Checklist de démo

1. `kubectl get all -n projet-final`
2. accès au frontend via l'Ingress
3. test de `api-catalogue` et `api-orders`
4. suppression d'un pod et recréation automatique
5. affichage du HPA avant et pendant charge
6. `kubectl rollout undo` sur une API
