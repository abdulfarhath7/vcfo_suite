variable "region" {
  default = "ap-south-1" # Mumbai — Indian data residency
}
variable "project" {
  default = "vcfo-suite"
}
variable "db_username" {
  default   = "vcfo"
  sensitive = true
}
variable "db_password" {
  sensitive = true
}
