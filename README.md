# Projet final - Clusteurisation de conteneurs

Application microservices déployée sur Kubernetes avec frontend, deux APIs, PostgreSQL, Ingress, HPA, Prometheus et Grafana.

## Architecture

- `frontend`: page statique servie par Nginx.
- `api-catalogue`: API Node.js exposant `/catalogue`.
- `api-orders`: API Node.js exposant `/orders`.
- `postgres`: base PostgreSQL gérée par `StatefulSet` + PVC.
- `prometheus` et `grafana`: supervision et visualisation.

Les ressources Kubernetes sont dans `k8s/` et sont déployées dans le namespace `projet-final`.

## Prérequis

- Un cluster Kubernetes accessible.
- `kubectl` configuré.
- Un Ingress controller compatible Nginx.
- `metrics-server` installé pour l'HPA.
- Les secrets GitHub configurés si la CI/CD est utilisée.

## Déploiement

### 1. Créer le namespace et les ressources de base

```bash
kubectl apply -f k8s/infra/namespace.yaml
kubectl apply -f k8s/infra/configmap.yaml
kubectl apply -f k8s/data/postgres-init-configmap.yaml
kubectl apply -f k8s/data/postgres-statefulset.yaml
kubectl apply -f k8s/data/postgres-service.yaml
```

### 2. Déployer les applications

```bash
kubectl apply -f k8s/apps/frontend-deployment.yaml
kubectl apply -f k8s/apps/frontend-service.yaml
kubectl apply -f k8s/apps/api-catalogue-deployment.yaml
kubectl apply -f k8s/apps/api-catalogue-service.yaml
kubectl apply -f k8s/apps/api-orders-deployment.yaml
kubectl apply -f k8s/apps/api-orders-service.yaml
kubectl apply -f k8s/apps/api-orders-hpa.yaml
```

### 3. Déployer l'observabilité et l'exposition externe

```bash
kubectl apply -f k8s/monitoring/prometheus.yaml
kubectl apply -f k8s/monitoring/grafana.yaml
kubectl apply -f k8s/infra/ingress.yaml
```

## Validation rapide

```bash
kubectl get all -n projet-final
kubectl get ingress -n projet-final
kubectl get hpa -n projet-final
kubectl logs deploy/api-orders -n projet-final
```

## Choix techniques

- `StatefulSet` pour PostgreSQL afin d'avoir un volume persistant.
- `RollingUpdate` pour limiter la coupure lors des mises à jour.
- `ClusterIP` pour garder les services internes non exposés directement.
- `Ingress` pour centraliser l'accès externe.
- `HPA` sur `api-orders` pour démontrer la scalabilité horizontale.

## Limites

- La sécurité Kubernetes est minimale: pas encore de `NetworkPolicy`, `RBAC` dédié ou durcissement complet des pods.
- L'alerte automatique n'est pas encore formalisée avec Alertmanager.
- Les preuves de résilience et de scale doivent être montrées en démo avec les commandes du runbook.
