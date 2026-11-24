# SharePoint client folders (docs/context/notes/sharepoint.md). Ask VCFO reads /Clients/<client>
# as the signed-in person through their Outlook connection. Not secret: a site address and a path.
# The Azure app needs the delegated Files.Read.All and Sites.Read.All permissions (granted
# 24 Nov 2026) before sharepoint_site_url is set, because setting it adds those scopes to connect.

variable "sharepoint_site_url" {
  description = "The SharePoint site that holds the client folders; empty keeps SharePoint off."
  type        = string
  default     = ""
}

variable "sharepoint_clients_path" {
  description = "The clients folder inside the site, library first, for example \"SteadFast/Clients\"."
  type        = string
  default     = "/Clients"
}

locals {
  sharepoint_env = var.sharepoint_site_url == "" ? {} : {
    SHAREPOINT_SITE_URL     = var.sharepoint_site_url
    SHAREPOINT_CLIENTS_PATH = var.sharepoint_clients_path
  }
}
