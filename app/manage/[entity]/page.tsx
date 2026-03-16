import { AppShell } from "../../../components/app-shell"
import { CatalogManager } from "../../../components/catalog-manager"
import { catalogConfig, isCatalogEntity } from "@/lib/catalog"
import { notFound, redirect } from "next/navigation"

type ManagePageProps = {
    params: Promise<{ entity: string }>
}

export default async function ManageEntityPage({ params }: ManagePageProps) {
    const { entity } = await params

    if (!isCatalogEntity(entity)) {
        notFound()
    }

    if (entity === "sales-managers") {
        redirect("/records#sales-manager-plans")
    }

    const meta = catalogConfig[entity]

    return (
        <AppShell
            activeItem={meta.activeItem}
            eyebrow="Master Data"
            title={meta.title}
            description={`Create, rename, and delete ${meta.title.toLowerCase()} while keeping imported sales data in sync.`}
        >
            <CatalogManager
                entity={entity}
                title={meta.title}
                singular={meta.singular}
            />
        </AppShell>
    )
}
