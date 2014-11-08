# Require any additional compass plugins here.
add_import_path "bower_components/foundation/scss"

dir = File.dirname(__FILE__)

# Set this to the root of your project when deployed:
http_path = "/"
css_dir = "stylesheets"
sass_dir = "scss"
images_dir = "images"
javascripts_dir = "js"
generated_images_path = File.expand_path('./images-dist')
generated_images_dir = File.expand_path('./images-dist')
http_images_dir = File.expand_path('./images-dist')

# generated_images_path = File.expand_path('./images/dist')
# generated_images_dir = File.expand_path('./images/dist')
# http_images_dir = File.expand_path('./images/dist')

# generated_images_dir = File.join("..", "build", "images")
# http_generated_images_path = "images/"

# You can select your preferred output style here (can be overridden via the command line):
# output_style = :expanded or :nested or :compact or :compressed
#output_style = :compressed

# To enable relative paths to assets via compass helper functions. Uncomment:
relative_assets = true

# To disable debugging comments that display the original location of your selectors. Uncomment:
# line_comments = false


# If you prefer the indented syntax, you might want to regenerate this
# project again passing --syntax sass, or you can uncomment this:
# preferred_syntax = :sass
# and then run:
# sass-convert -R --from scss --to sass sass scss && rm -rf sass && mv scss sass
