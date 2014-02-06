module.exports = function(grunt) {

    require("matchdep").filterDev("grunt-*").forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        htmlhint: {
            build: {
                options: {
                    'tag-pair': true,
                    'tagname-lowercase': true,
                    'attr-lowercase': true,
                    'attr-value-double-quotes': true,
                    'doctype-first': true,
                    'spec-char-escape': true,
                    'id-unique': true
                },
                src: ['index.html']
            }
        },

        uglify: {
            build: {
                files: {
                    'js/script.min.js': ['js/leaflet.js', 'js/d3.v3.min.js', 'js/mustache.js', 'js/bootstrap.min.js', 'js/typeahead.min.js', 'js/script.js']
                }
            }
        },

        cssmin: {
          combine: {
            files: {
              'css/style.min.css': ['css/bootstrap.min.css', 'css/typeahead.css', 'css/leaflet.css', 'css/styles.css']
            }
          }
        },

        watch: {
            html: {
                files: ['index.html'],
                tasks: ['htmlhint']
            },
            js: {
                files: ['js/bootstrap.min.js', 'js/typeahead.min.js', 'js/mustache.js', 'js/d3.v3.min.js', 'js/leaflet.js'],
                tasks: ['uglify']
            },
            css: {
                files: ['css/bootstrap.min.css', 'css/typeahead.css', 'css/leaflet.css', 'css/styles.css'],
                tasks: ['cssmin']
            }
        }
    });

    grunt.registerTask('default', ['htmlhint', 'uglify', 'cssmin']);

};