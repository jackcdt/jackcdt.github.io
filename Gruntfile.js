module.exports = function(grunt) {

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-autoprefixer');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-image');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-rename');
    var mozjpeg = require('imagemin-mozjpeg');


    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // concat: {
        //     dist: {
        //         src: [ 'js/jquery.js', 'js/foundation.min.js', 'megamenu-plugins-min.js', 'ng_responsive_tables.js', 'product-list-view.js', 'participants.js', 'fastclick.js'],
        //         dest: 'build/js/app.js'
        //     }
        // },

        compass: {
            dist: {
                options: {
                    config: 'config.rb',
                    force: true
                }
            }
        },
        copy: {
            main: {
                src: 'stylesheets/app.css',
                dest: 'stylesheets/app-ie.css',
            },
            favicon: {
                src: 'favicon.ico',
                dest: 'build/favicon.ico',
            },
            coursePdfs: {
                src: 'course-pdfs/*.pdf',
                dest: 'build/',
            },
            sitemapXml: {
                src: 'sitemap.xml',
                dest: 'build/sitemap.xml',
            },
            foundationJs: {
                src: 'bower_components/foundation/js/foundation.min.js',
                dest: 'build/bower_components/foundation/js/foundation.min.js',
            },
            appJs: {
                src: 'js/app.js',
                dest: 'build/js/app.js',
            },
            megamenuJs: {
                src: 'js/megamenu-plugins-min.js',
                dest: 'build/js/megamenu-plugins-min.js',
            },
            modernizrJs: {
                src: 'bower_components/modernizr/min/modernizr-min.js',
                dest: 'build/bower_components/modernizr/min/modernizr-min.js',
            },
            fastclickJs: {
                src: 'js/fastclick.js',
                dest: 'build/js/fastclick.js',
            },
            tableResponseJs: {
                src: 'js/ng_responsive_tables.js',
                dest: 'build/js/ng_responsive_tables.js',
            },
            participantsJs: {
                src: 'js/participants.js',
                dest: 'build/js/participants.js',
            },
            productListViewJs: {
                src: 'js/product-list-view.js',
                dest: 'build/js/product-list-view.js',
            },
            remJs: {
                src: 'js/rem.min.js',
                dest: 'build/js/rem.min.js',
            },
            templateDwt: {
                src: 'Templates/Main Template.dwt',
                dest: 'build/Templates/Main Template.dwt',
            }
        },
        cssmin: {
            minify: {
                expand: true,
                cwd: 'stylesheets/',
                src: ['*.css', '!*.min.css', '!build/*.css'],
                dest: 'build/stylesheets/',
            }
        },
        htmlmin: {
            dist: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                },
                expand: true,
                cwd: '',
                src: ['**/*.html', '!build/**/*.html'],
                dest: 'build/'
            }
        },
        imagemin: { // Task

            dynamic: { // Another target
                files: [{
                    expand: true, // Enable dynamic expansion
                    cwd: 'images-dist', // Src matches are relative to this path
                    src: ['**/*.{png,jpg,gif}'], // Actual patterns to match
                    dest: 'build/images-dist' // Destination path prefix
                }]
            }
        }
     });


    // Default task(s).
    grunt.registerTask('default', ['compass', 'copy', 'cssmin', 'htmlmin', 'imagemin']);

};