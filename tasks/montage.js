module.exports = function (grunt) {

    "use strict";

    var exec = require("child_process").exec,
        path = require("path"),
        mkdirp = require("mkdirp"),
        rSpecial = /([!"#$%&'()*+,-.\/:;<=>?@[\]\\^`{}|~])/g;

    // Build a CSS rule in the format 'selector { property: value; [... property: value;] }'
    function buildRule(selector, properties) {
        return selector + " { " + Object.keys(properties).map(function (property) {
            return property + ": " + properties[property] + ";";
        }).join(" ") + " }\n";
    }

    function calcArrangement(arrangeOptions, imgs) {
        var arrange = {
            rows: 0,
            cols: 0
        };

        if (!arrangeOptions.cols || arrangeOptions.cols > imgs || arrangeOptions.cols <= 0) {
            if (!arrangeOptions.rows || arrangeOptions.rows > imgs || arrangeOptions.rows <= 0) {
                arrangeOptions.rows = Math.ceil(Math.sqrt(imgs));
            }

            arrangeOptions.cols = Math.ceil(imgs / arrangeOptions.rows);
        }

        arrange.cols = arrangeOptions.cols;
        arrange.rows = Math.ceil(imgs / arrange.cols);

        return arrange;
    }

    grunt.registerMultiTask("montage", "Generate CSS sprite sheets and the corresponding stylesheet", function () {

        // It's an async task so make sure Grunt knows this
        var done = this.async(),
            cliOptions = "",
            options = {},
            defaults = {
                size: 16,
                arrange: {},
                basePrefix: ".montage",
                prefix: ".",
                suffix: "",
                outputImage: "montage.png",
                outputImageOverriddenName: null,
                outputStylesheet: "montage.css",
                baseRules: {},
                magick: {}
            };

        // Configuration
        Object.keys(defaults).forEach(function (option) {
            if (this.data.options && this.data.options[option] !== undefined) {
                options[option] = this.data.options[option];
            } else {
                options[option] = defaults[option];
            }
        }, this);

        if (!isNaN(options.size)) {
            options.size = {
                width: options.size,
                height: options.size
            };
        }

        // Add necessary style rules to the base CSS
        var outputImageName = options.outputImageOverriddenName
            ? options.outputImageOverriddenName
            : options.outputImage;
        options.baseRules.background = "url('" + outputImageName + "') no-repeat";
        options.baseRules.width = options.size.width + "px";
        options.baseRules.height = options.size.height + "px";

        // Build ImageMagick montage option string
        cliOptions = Object.keys(options.magick).map(function (option) {
            return "-" + option + " " + options.magick[option];
        }).join(" ");

        // Iterate over all specified file groups.
        this.files.forEach(function (files) {
            // Remove non-existent files from the list
            var src = files.src.filter(function (file) {
                    if (!grunt.file.exists(file)) {
                        grunt.log.warn("Source file '" + file + "' not found.");
                        return false;
                    }
                    return true;
                }),
                dest = path.join(files.dest, options.outputImage),
                css = buildRule(options.basePrefix + options.suffix, options.baseRules),
                arrange = calcArrangement(options.arrange, src.length),
                filesList = src.map(function (img) {
                    return "\"" + img + "\"";
                }).join(" ");

            // Create the output directory if necessary (ImageMagick errors if it doesn't exist)
            if (!grunt.file.exists(files.dest)) {
                mkdirp(files.dest);
            }

            // Generate a stylesheet
            css += src.map(function (image, i) {
                var offsetLeft = (-options.size.width * (i % arrange.cols)) + "px",
                    offsetTop = (-options.size.height * Math.floor(i / arrange.cols)) + "px",
                    className = path.basename(image)
                                    .replace(/\.\w+$/, "")
                                    .replace(rSpecial, "\\$1")
                                    .replace(/\s+/g, "_");

                return buildRule(options.basePrefix + options.prefix + className + options.suffix, {
                    "background-position": offsetLeft + " " + offsetTop
                });
            }).join("");

            grunt.file.write(path.join(files.dest, options.outputStylesheet), css);

            // Execute the ImageMagick montage tool
            exec("montage -tile " + arrange.cols + "x -geometry " + options.size.width + "x" + options.size.height + " " + cliOptions + " " + filesList + " " + dest, function (err) {
                done();
            });
        });
    });

};