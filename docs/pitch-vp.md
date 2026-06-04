# Launchpad — A Scalable Platform for Independent Applications

## Core principle

> Applications remain independent by design, while the customer experience remains cohesive through shared standards, shared services, and shared platform capabilities.

This principle is the foundation of Launchpad.

Rather than requiring applications to share runtimes, release cycles, or integration contracts, Launchpad enables teams to independently build, deploy, and evolve applications while still participating in a unified Rosnet platform experience.

## Opportunity

As Rosnet continues to invest in new products and capabilities, we need a scalable way to deliver net-new applications without increasing architectural coupling between teams or slowing delivery through shared deployment and release dependencies.

Today's frontend integration approaches — shell applications, runtime injection, iframes — can provide a unified experience, but they also create coordination overhead and increase the risk that a change in one application impacts another.

Launchpad is an alternative that prioritizes both consistency and independence.

## Existing proof point

The pattern already exists internally through the [Prototype Viewer](https://proto-viewer.rosnetdev.com/). Originally created to support prototyping and stakeholder validation, it demonstrates a broader architectural pattern that can be extended to deliver production applications.

## Vision

Launchpad would provide a shared platform where teams independently build, deploy, and evolve applications while maintaining a cohesive customer experience across the Rosnet ecosystem.

Applications can share:

- Authentication and user context
- Common platform services
- Navigation patterns
- Rosnet UI components and the Tailwind-based design system
- Accessibility standards
- Shared operational capabilities (deploy, rollback, versioning, previews)

At the same time, applications remain independently deployable and free to evolve at their own pace.

Most net-new applications would be encouraged to use Rosnet UI and our shared design system, creating consistency across products while reducing duplicated effort. Launchpad does not, however, require applications to adopt a specific framework or component library — that flexibility ensures teams can choose the right tool when business needs dictate.

## Benefits

**Faster delivery.** Teams can build and release applications independently, without becoming tightly coupled to the release schedules or implementation decisions of other teams.

**Reduced architectural coupling.** Applications can evolve independently, adopt new technologies when appropriate, and maintain their own release cadence without introducing risk across the broader platform.

**Consistent customer experience.** Consistency is achieved through shared design standards, Rosnet UI, accessibility practices, navigation patterns, and platform services — not through runtime coupling.

**Operational flexibility.** The model naturally supports independent deployments, versioning, rollback, preview environments, future-dated releases, and simplified lifecycle management.

**Technology flexibility.** The platform stays focused on hosting, routing, authentication, and shared services rather than enforcing a specific frontend architecture.

## Strategic value

Rather than building an increasingly large shell application that every new product must integrate with, Launchpad allows teams to deliver independently deployable applications that share common standards and services where it creates value.

This approach balances platform consistency with team autonomy, enabling Rosnet to scale both its products and its teams without introducing unnecessary architectural coupling.

## Summary

Launchpad provides a platform strategy that combines:

- Shared user experience standards
- Shared authentication and platform services
- Independent deployments
- Reduced architectural coupling
- Technology flexibility
- Faster delivery of net-new applications

The result is a platform that scales with both our products and our teams while preserving the consistency our customers expect.
