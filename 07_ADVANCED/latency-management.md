# Latency Management (Speed/Quality Trade-offs)

Strategies
- Parallelizable steps: run lint/tests in matrix
- Early fail: quick static checks before heavy runs
- Caching: dependency and build caches
- Model choice: faster planning model for iterative loops

Checklist
- [ ] Identify serial vs parallel steps
- [ ] Add CI caching (npm/pip/gradle)
- [ ] Timebox planning (e.g., 3 iterations)
