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
    grunt.loadNpmTasks('grunt-bless');
    grunt.loadNpmTasks('grunt-image');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-contrib-compass');
    var mozjpeg = require('imagemin-mozjpeg');

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        bless: {
            css: {
              files: {
                'stylesheets/app.css': 'stylesheets/app.css'
              }
            }
        },

        concat: {
            dist: {
                src: ['js/fastclick.js', 'js/megamenu-plugins-min.js', 'js/ng_responsive_tables.js', 'js/product-list-view.js', 'bower_components/foundation/js/foundation.min.js'],
                dest: 'temp/js/app.js'
            }
        },

        compass: {
            dist: {
                options: {
                    config: 'config.rb',
                    force: true
                }
            }
        },

        uglify: {
            dist: {
                src: 'temp/js/app.js',
                dest: 'build/js/app.js'
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
    grunt.registerTask('default', ['compass', 'concat', 'uglify', 'cssmin', 'htmlmin', 'imagemin']);

};
