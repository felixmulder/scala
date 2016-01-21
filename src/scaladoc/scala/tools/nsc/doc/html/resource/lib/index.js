// © 2009–2010 EPFL/LAMP
// code by Gilles Dubochet with contributions by Johannes Rudolph, "spiros", Marcin Kubala and Felix Mulder

var topLevelTemplates = undefined;
var topLevelPackages = undefined;

var scheduler = undefined;

var kindFilterState = undefined;
var focusFilterState = undefined;

var title = $(document).attr('title');

var lastFragment = "";

var scrollPaneApi = undefined;

$(document).ready(function() {
    /* check if browser is mobile, if so hide class nav */
    if(isMobile()) {
        $("#browser").toggleClass("full-screen");
        $("#content").toggleClass("full-screen");
        $("#kindfilter").toggle();
    }

    $('iframe').bind("load", function(){
        try {
            var subtitle = $(this).contents().find('title').text();
            $(document).attr('title', (title ? title + " - " : "") + subtitle);
        } catch (e) {
            // Chrome doesn't allow reading the iframe's contents when
            // used on the local file system.
        }
        setUrlFragmentFromFrameSrc();
    });

    // workaround for IE's iframe sizing lack of smartness
    if($.browser.msie) {
        function fixIFrame() {
            $('iframe').height($(window).height() )
        }
        $('iframe').bind("load",fixIFrame)
        $('iframe').bind("resize",fixIFrame)
    }

    scheduler = new Scheduler();
    scheduler.addLabel("init", 1);
    scheduler.addLabel("focus", 2);
    scheduler.addLabel("filter", 4);
    scheduler.addLabel("search", 5);

    prepareEntityList();
    configureTextFilter();
    configureEntityList();

    setFrameSrcFromUrlFragment();

    // If the url fragment changes, adjust the src of iframe "template".
    $(window).bind('hashchange', function() {
      if(lastFragment != window.location.hash) {
        lastFragment = window.location.hash;
        setFrameSrcFromUrlFragment();
      }
    });

    // Wait until page has loaded until binding input fields, setting fold all
    setTimeout(function() {
      configureKindFilter();

      $("#index-input").on("focus", function() {
          $("#textfilter > .input > .clear").show();
      });

      $("#index-input").on("blur", function() {
          setTimeout(function() {
              $("#textfilter > .input > .clear").hide();
          }, 10);
      });
    }, 1500);
});

// Set the iframe's src according to the fragment of the current url.
// fragment = "#scala.Either" => iframe url = "scala/Either.html"
// fragment = "#scala.Either@isRight:Boolean" => iframe url = "scala/Either.html#isRight:Boolean"
// fragment = "#scalaz.iteratee.package@>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]" => iframe url = "scalaz/iteratee/package.html#>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]"
function setFrameSrcFromUrlFragment() {

    function extractLoc(fragment) {
        var loc = fragment.split('@')[0].replace(/\./g, "/");
        if (loc.indexOf(".html") < 0) {
            loc += ".html";
        }
        return loc;
    }

    function extractMemberSig(fragment) {
        var splitIdx = fragment.indexOf('@');
        if (splitIdx < 0) {
            return;
        }
        return fragment.substr(splitIdx + 1);
    }

    var fragment = location.hash.slice(1);
    if (fragment) {
        var locWithMemeberSig = extractLoc(fragment);
        var memberSig = extractMemberSig(fragment);
        if (memberSig) {
            locWithMemeberSig += "#" + memberSig;
        }
        frames["template"].location.replace(location.protocol + locWithMemeberSig);
    } else {
        console.log("empty fragment detected");
        frames["template"].location.replace("package.html");
    }
}

// Set the url fragment according to the src of the iframe "template".
// iframe url = "scala/Either.html"  =>  url fragment = "#scala.Either"
// iframe url = "scala/Either.html#isRight:Boolean"  =>  url fragment = "#scala.Either@isRight:Boolean"
// iframe url = "scalaz/iteratee/package.html#>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]" => fragment = "#scalaz.iteratee.package@>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]"
function setUrlFragmentFromFrameSrc() {
  try {
    var commonLength = location.pathname.lastIndexOf("/");
    var frameLocation = frames["template"].location;
    var relativePath = frameLocation.pathname.slice(commonLength + 1);

    if(!relativePath || frameLocation.pathname.indexOf("/") < 0)
      return;

    // Add #, remove ".html" and replace "/" with "."
    fragment = "#" + relativePath.replace(/\.html$/, "").replace(/\//g, ".");

    // Add the frame's hash after an @
    if(frameLocation.hash) fragment += ("@" + frameLocation.hash.slice(1));

    // Use replace to not add history items
    lastFragment = fragment;
    location.replace(fragment);
  }
  catch(e) {
    // Chrome doesn't allow reading the iframe's location when
    // used on the local file system.
  }
}

var Index = {};

(function (ns) {
    function openLink(t, type) {
        var href;
        if (type == 'object') {
            href = t['object'];
        } else {
            href = t['class'] || t['trait'] || t['case class'] || t['type'];
        }
        return [
            '<a class="tplshow" target="template" href="',
            href,
            '"><div class="type-circle ',
            type,
            '"><span>',
            type.charAt(0).toLowerCase(),
            '</span></div>'
        ].join('');
    }

    function createPackageHeader(pack) {
        return [
            '<li class="pack">',
            '<a class="packfocus">focus</a><a class="packhide">hide</a>',
            '<a class="tplshow" target="template" href="',
            pack.replace(/\./g, '/'),
            '/package.html">',
            pack,
            '</a></li>'
        ].join('');
    };

    function createListItem(template) {
        var inner = '';


        if (template.object) {
            inner += openLink(template, 'object');
        }

        if (template['class'] || template['trait'] || template['case class'] || template['type']) {
            inner += (inner == '') ?
                '<div class="placeholder" />' : '</a>';
            inner += openLink(template, template['trait'] ? 'trait' : template['type'] ? 'type' : 'class');
        } else {
            inner += '<div class="placeholder"/>';
        }

        return [
            '<li>',
            inner,
            '<span class="tplLink">',
            template.name.replace(/^.*\./, ''),
            '</span></a></li>'
        ].join('');
    }


    ns.createPackageTree = function (pack, matched, focused) {
        var html = $.map(matched, function (child, i) {
            return createListItem(child);
        }).join('');

        var header;
        if (focused && pack == focused) {
            header = '';
        } else {
            header = createPackageHeader(pack);
        }

        return [
            '<ol class="packages">',
            header,
            '<ol class="templates">',
            html,
            '</ol></ol>'
        ].join('');
    }

    ns.keys = function (obj) {
        var result = [];
        var key;
        for (key in obj) {
            result.push(key);
        }
        return result;
    }

    var hiddenPackages = {};

    function subPackages(pack) {
        return $.grep($('#tpl ol.packages'), function (element, index) {
            var pack = $('li.pack > .tplshow', element).text();
            return pack.indexOf(pack + '.') == 0;
        });
    }

    ns.hidePackage = function (ol) {
        var selected = $('li.pack > .tplshow', ol).text();
        hiddenPackages[selected] = true;

        $('ol.templates', ol).hide();

        $.each(subPackages(selected), function (index, element) {
            $(element).hide();
        });
    }

    ns.showPackage = function (ol, state) {
        var selected = $('li.pack > .tplshow', ol).text();
        hiddenPackages[selected] = false;

        $('ol.templates', ol).show();

        $.each(subPackages(selected), function (index, element) {
            $(element).show();

            // When the filter is in "packs" state,
            // we don't want to show the `.templates`
            var key = $('li.pack > .tplshow', element).text();
            if (hiddenPackages[key] || state == 'packs') {
                $('ol.templates', element).hide();
            }
        });
    }

})(Index);

function configureEntityList() {
    kindFilterSync();
    configureHideFilter();
    configureFocusFilter();
    textFilter();
}

/**
 * Updates the list of entities (i.e. the content of the #tpl element) from the
 * raw form generated by Scaladoc to a form suitable for display. It configures
 * links to open in the right frame. Furthermore, it sets the two reference
 * top-level entities lists (topLevelTemplates and topLevelPackages) to serve
 * as reference for resetting the list when needed.
 *
 * Be advised: this function should only be called once, on page load.
 */
function prepareEntityList() {
    $('#tpl li.pack > a.tplshow').attr("target", "template");
    $('#tpl li.pack')
        .prepend("<a class='packhide'>hide</a>")
        .prepend("<a class='packfocus'>focus</a>");
}

/* Handles all key presses while scrolling around with keyboard shortcuts in search results */
function handleKeyNavigation() {
    /** Iterates both back and forth among selected elements */
    var EntityIterator = function (items) {
        var it = this;
        this.index = -1;
        this.items = items;

        /** Returns the next entry - if trying to select past last element, it
         * returns the last element
         */
        it.next = function() {
            it.index = Math.min(it.items.length - 1, it.index + 1);
            return $(it.items[it.index]);
        };

        /** Returns the previous entry - will return `undefined` instead if
         * selecting up from first element
         */
        it.prev = function() {
            it.index = Math.max(-1, it.index - 1);
            return it.index == -1 ? undefined : $(it.items[it.index]);
        };
    };

    /** Scroll helper, ensures that the selected elem is inside the viewport */
    var Scroller = function ($container) {
        scroller = this;
        scroller.container = $container;

        scroller.scrollDown = function($elem) {
            var yPos = $elem.offset().top; // offset relative to viewport
            if ($container.height() < yPos) {
                $container.animate({
                    scrollTop: $container.scrollTop() + yPos - $("#search").height() - 10
                }, 200);
            }
        };

        scroller.scrollUp = function ($elem) {
            var yPos = $elem.offset().top; // offset relative to viewport
            if (yPos < $("#search").height()) {
                $container.animate({
                    scrollTop: $container.scrollTop() + yPos - $("#search").height() - 10
                }, 200);
            }
        };

        scroller.scrollTop = function() {
            $container.animate({
                scrollTop: 0
            }, 200);
        }
    };

    scheduler.add("init", function() {
        $("#textfilter input").blur();
        var items = new EntityIterator(
            $("div#results-content > ul.entities span.entity > a").toArray()
        );

        var scroller = new Scroller($("#search-results"));

        var $old = items.next();
        $old.addClass("selected");

        $(window).bind("keydown", function(e) {
            switch ( e.keyCode ) {
            case 9: // tab
                $old.removeClass("selected");
                break;

            case 13: // enter
                var href = $old.attr("href");
                location.replace(href);
                $old.click();
                $("#textfilter input").attr("value", "");
                break;

            case 38: // up
                $old.removeClass('selected');
                $old = items.prev();

                if ($old === undefined) {
                    $(window).unbind("keydown");
                    $("#textfilter input").focus();
                    scroller.scrollTop();
                    return false;
                } else {
                    $old.addClass("selected");
                    scroller.scrollUp($old);
                }
                break;

            case 40: // down
                $old.removeClass("selected");
                $old = items.next();
                $old.addClass("selected");
                scroller.scrollDown($old);
                break;
            }
        });
    });
}

/* Configures the text filter  */
var callingSearch = false;
function configureTextFilter() {
    scheduler.add("init", function() {
        $("#search").prepend("<span class='toggle-sidebar'></span>");
        var input = $("#textfilter input");
        // token used to cancel running search
        input.bind('keyup', function(event) {
            switch ( event.keyCode ) {
                case 27: // escape
                    input.attr("value", "");
                    $("div#search-results").hide();
                    $("#search > span.close-results").hide();
                    $("#search > span.toggle-sidebar").show();
                    $("#search > span#doc-title").show();
                    break;

                case 38: // up arrow
                    return false;

                case 40: // down arrow
                    $(window).unbind("keydown");
                    handleKeyNavigation();
                    return false;
            }

            searchAll();
        });
    });
    scheduler.add("init", function() {
        $("#textfilter > .input > .clear").click(function() {
            $("#textfilter input").attr("value", "");
            $("div#search-results").hide();
            $("#search > span.close-results").hide();
            $("#search > span.toggle-sidebar").show();
            $("#search > span#doc-title").show();
        });
        $("#search > span.toggle-sidebar").click(function() {
            $("#browser").toggleClass("full-screen");
            $("#content").toggleClass("full-screen");
            $("#kindfilter").toggle();
        });
    });

    scheduler.add("init", function() {
        $("div#search > span.close-results").click(function() {
            $("div#search-results").hide();
            $("#search > span.close-results").hide();
            $("#search > span.toggle-sidebar").show();
            $("#search > span#doc-title").show();
            $("#textfilter input").attr("value", "");
        });
    });
}

function compilePattern(query) {
    var escaped = query.replace(/([\.\*\+\?\|\(\)\[\]\\])/g, '\\$1');

    if (query.toLowerCase() != query) {
        // Regexp that matches CamelCase subbits: "BiSe" is
        // "[a-z]*Bi[a-z]*Se" and matches "BitSet", "ABitSet", ...
        return new RegExp(escaped.replace(/([A-Z])/g,"[a-z]*$1"));
    }
    else { // if query is all lower case make a normal case insensitive search
        return new RegExp(escaped, "i");
    }
}

// Filters all focused templates and packages. This function should be made less-blocking.
//   @param query The string of the query
function textFilter() {
    if (scrollPaneApi)
        scrollPaneApi.destroy();

    var query = $("#textfilter input").attr("value") || '';
    var queryRegExp = compilePattern(query);

    // if we are filtering on types, then we have to display types
    // ("display packages only" is not possible when filtering)
    if (query !== "") {
        kindFilter("all");
    }

    // Three things trigger a reload of the left pane list:
    // typeof textFilter.lastQuery === "undefined" <-- first load, there is nothing yet in the left pane
    // textFilter.lastQuery !== query              <-- the filter text has changed
    // focusFilterState != null                    <-- a package has been "focused"
    if ((typeof textFilter.lastQuery === "undefined") || (textFilter.lastQuery !== query) || (focusFilterState != null)) {

        textFilter.lastQuery = query;

        scheduler.clear("filter");

        $('#tpl').html('');

        var index = 0;

        var searchLoop = function () {
            var packages = Index.keys(Index.PACKAGES).sort();

            while (packages[index]) {
                var pack = packages[index];
                var children = Index.PACKAGES[pack];
                index++;

                if (focusFilterState) {
                    if (pack == focusFilterState ||
                        pack.indexOf(focusFilterState + '.') == 0) {
                        ;
                    } else {
                        continue;
                    }
                }

                var matched = $.grep(children, function (child, i) {
                    return queryRegExp.test(child.name);
                });

                if (matched.length > 0) {
                    $('#tpl').append(Index.createPackageTree(pack, matched,
                                                             focusFilterState));

                    scheduler.add('filter', searchLoop);
                    return;
                }
            }

            $('#tpl a.packfocus').click(function () {
                focusFilter($(this).parent().parent());
                $("#tpl").addClass("packfocused");
            });
            configureHideFilter();
        };

        scheduler.add('filter', searchLoop);
    }

    scheduler.scheduleLast("filter", function () {
        if (!isMobile()) {
            scrollPaneApi = $("#tpl").jScrollPane({
                contentWidth: '0px',
                verticalDragMinHeight: 140,
            }).data().jsp;
        }
    });
}

/* Configures the hide tool by adding the hide link to all packages. */
function configureHideFilter() {
    $('#tpl li.pack a.packhide').click(function () {
        var packhide = $(this)
        var action = packhide.text();

        var ol = $(this).parent().parent();

        if (action == "hide") {
            Index.hidePackage(ol);
            packhide.text("show");
        }
        else {
            Index.showPackage(ol, kindFilterState);
            packhide.text("hide");
        }
        return false;
    });
}

/* Configures the focus tool by adding the focus bar in the filter box (initially hidden), and by adding the focus
   link to all packages. */
function configureFocusFilter() {
    scheduler.add("init", function() {
        focusFilterState = null;
        $("#focusfilter > .focusremove").click(function(event) {
            textFilter();
            $("#focusfilter").hide();
            $("#kindfilter").show();
            $("#tpl").removeClass("packfocused");
            focusFilterState = null;
        });
    });
    scheduler.add("init", function() {
        $('#tpl li.pack a.packfocus').click(function () {
            focusFilter($(this).parent());
            return false;
        });
    });
}

/* Focuses the entity index on a specific package. To do so, it will copy the sub-templates and sub-packages of the
   focuses package into the top-level templates and packages position of the index. The original top-level
     @param package The <li> element that corresponds to the package in the entity index */
function focusFilter(package) {
    scheduler.clear("filter");

    var currentFocus = $('li.pack > .tplshow', package).text();
    $("#focusfilter > .focuscoll").empty();
    $("#focusfilter > .focuscoll").append(currentFocus);

    $("#focusfilter").show();
    $("#kindfilter").hide();
    focusFilterState = currentFocus;
    kindFilterSync();

    textFilter();
}

function configureKindFilter() {
    scheduler.add("init", function() {
        kindFilterState = "all";
        $("#kindfilter").unbind("click");
        $("#kindfilter").click(function(event) {
            $("#kindfilter").toggleClass("open");
            kindFilter("packs");
        });
    });
}

function kindFilter(kind) {
    if (kind == "packs") {
        kindFilterState = "packs";
        kindFilterSync();
        $("#kindfilter > span").replaceWith("<span>Unfold All</span>");
        $("#kindfilter").unbind("click");
        $("#kindfilter").click(function(event) {
            $("#kindfilter").toggleClass("open");
            kindFilter("all");
        });
    }
    else {
        kindFilterState = "all";
        kindFilterSync();
        $("#kindfilter > span").replaceWith("<span>Fold All</span>");
        $("#kindfilter").unbind("click");
        $("#kindfilter").click(function(event) {
            $("#kindfilter").toggleClass("open");
            kindFilter("packs");
        });
    }
}

/* Applies the kind filter. */
function kindFilterSync() {
    if (kindFilterState == "all" || focusFilterState != null) {
        $("#tpl a.packhide").text('hide');
        $("#tpl ol.templates").show();
    } else {
        $("#tpl a.packhide").text('show');
        $("#tpl ol.templates").hide();
    }
}

/** Searches packages for entites matching the search query using a regex
 *
 * @param {[Object]} pack: package being searched
 * @param {RegExp} regExp: a regular expression for finding matching entities
 * @return {Promise} a promise containing {"matched": [], "notMatching": [], package: String}
 */
function searchPackage(pack, regExp) {
    scheduler.add("search", function() {
        var entities = Index.PACKAGES[pack];
        var matched = [];
        var notMatching = [];


        entities.forEach(function (elem) {
            regExp.test(elem.name) ? matched.push(elem) : notMatching.push(elem);
        });

        var results = {
            "matched": matched,
            "notMatching": notMatching,
            "package": pack
        };


        scheduler.add("search", function() {
            handleSearchedPackage(results, regExp);
        });
    });
}

function handleNonMatchingEntry(entity, ul, regExp, packageH1) {
    var membersUl = document.createElement("ul");
    searchEntity(entity, membersUl, regExp)
        .then(function(res) {
            if (res.length == 0) return;

            packageH1.style.display = "block";

            var name = entity.name.split('.').pop()
            var nameElem = document.createElement("span");
            nameElem.className = "entity";

            var entityUrl = document.createElement("a");
            entityUrl.title = name;
            entityUrl.href = "#" + entity.name;

            if (entity.kind == "object")
                entityUrl.href += "$";

            entityUrl.appendChild(document.createTextNode(name));

            $(entityUrl).click(function() {
                $("div#search-results").hide();
                $("#search > span.close-results").hide();
                $("#search > span.toggle-sidebar").show();
                $("#search > span#doc-title").show();
            });

            nameElem.appendChild(entityUrl);

            var iconElem = document.createElement("div");
            iconElem.className = "icon " + entity.kind;

            var li = document.createElement("li");
            li.id = entity.name.replace(new RegExp("\\.", "g"),"-");
            li.appendChild(iconElem);
            li.appendChild(nameElem);

            membersUl.className = "members";
            li.appendChild(membersUl);

            insertSorted(ul, li);
        })
}

/** This function inserts `li` into the `ul` ordered by the li's id
 *
 * @param {Node} ul: the list in which to insert `li`
 * @param {Node} li: item to insert
 */
function insertSorted(ul, li) {
    var lis = ul.childNodes;
    var beforeLi = null;

    for (var i = 0; i < lis.length; i++) {
        if (lis[i].id > li.id)
            beforeLi = lis[i];
    }

    // if beforeLi == null, it will be inserted last
    ul.insertBefore(li, beforeLi);
}

/** Defines the callback when a package has been searched and searches its
 * members
 *
 * It will search all entities which matched the regExp.
 *
 * @param {Object} res: this is the searched package. It will contain the map
 * from the `searchPackage`function.
 * @param {RegExp} regExp
 */
function handleSearchedPackage(res, regExp) {
    $("div#search-results").show();
    $("#search > span.close-results").show();
    $("#search > span.toggle-sidebar").hide();
    $("#search > span#doc-title").hide();

    var searchRes = document.getElementById("results-content")
    var h1 = document.createElement("h1");
    h1.className = "package";
    h1.appendChild(document.createTextNode(res.package));

    if (res.matched.length == 0)
        h1.style.display = "none";

    searchRes.appendChild(h1);

    var ul = document.createElement("ul")
    ul.className = "entities";

    // Generate html list items from results
    res.matched
       .map(function(entity) { return listItem(entity, regExp); })
       .forEach(function(li) { ul.appendChild(li); });

    // Generate html (potentially) for items not matching the regExp
    res.notMatching
       .forEach(function(entity) { handleNonMatchingEntry(entity, ul, regExp, h1); });

    searchRes.appendChild(ul);
}

/** Searches an entity asynchronously for regExp matches in an entity's members
 *
 * @param {Object} entity - the entity to be searched
 * @param {Node} ul: the list in which to insert the list item created
 * @param {RegExp} regExp
 */
function searchEntity(entity, ul, regExp) {
    return new Promise(function(resolve, reject) {
        var matchingMembers = $.grep(entity.members, function(member, i) {
            return regExp.test(member.label);
        });

        resolve(matchingMembers);
    })
    .then(function(res) {
        res.forEach(function(elem) {
            var kind = document.createElement("span");
            kind.className = "kind";
            kind.appendChild(document.createTextNode(elem.kind));

            var label = document.createElement("a");
            label.title = elem.label;
            label.href = elem.link;
            label.className = "label";
            label.appendChild(document.createTextNode(elem.label));

            $(label).click(function() {
                $("div#search-results").hide();
                $("#search > span.close-results").hide();
                $("#search > span.toggle-sidebar").show();
                $("#search > span#doc-title").show();
                $("#textfilter input").attr("value", "");
            });

            var tail = document.createElement("span");
            tail.className = "tail";
            tail.appendChild(document.createTextNode(elem.tail));

            var li = document.createElement("li");
            li.appendChild(kind);
            li.appendChild(label);
            li.appendChild(tail);

            ul.appendChild(li);
        });
        return res;
    });
}

/** Creates a list item representing an entity
 *
 * @param {Object} entity, the searched entity to be displayed
 * @param {RegExp} regExp
 * @return {Node} list item containing entity
 */
function listItem(entity, regExp) {
    var name = entity.name.split('.').pop()
    var nameElem = document.createElement("span");
    nameElem.className = "entity";

    var entityUrl = document.createElement("a");
    entityUrl.title = name;
    entityUrl.href = "#" + entity.name;

    if (entity.kind == "object")
        entityUrl.href += "$";

    entityUrl.appendChild(document.createTextNode(name));

    $(entityUrl).click(function() {
        $("div#search-results").hide();
        $("#search > span.close-results").hide();
        $("#search > span.toggle-sidebar").show();
        $("#search > span#doc-title").show();
        $("#textfilter input").attr("value", "");
    });

    nameElem.appendChild(entityUrl);

    var iconElem = document.createElement("div");
    iconElem.className = "icon " + entity.kind;

    var li = document.createElement("li");
    li.id = entity.name.replace(new RegExp("\\.", "g"),"-");
    li.appendChild(iconElem);
    li.appendChild(nameElem);

    var ul = document.createElement("ul");
    ul.className = "members";

    li.appendChild(ul);
    searchEntity(entity, ul, regExp);

    return li;
}

/** Searches all packages and entities for the current search string in
 *  the input field "#textfilter"
 *
 * Then shows the results in div#search-results
 */
function searchAll() {
    scheduler.clear("search"); // clear previous search
    var searchStr = $("#textfilter input").attr("value").trim() || '';

    if (searchStr === '') {
        $("div#search-results").hide();
        $("#search > span.close-results").hide();
        $("#search > span.toggle-sidebar").show();
        $("#search > span#doc-title").show();
        return;
    }

    // Clear input field and results so as not to doubly display data
    $("div#search-results > div#results-content").html("");

    $("div#results-content")
        .prepend("<span class='search-text'>"
                +"  Showing results for <span class='query-str'>\"" + searchStr + "\"</span>"
                +"</span>");

    var regExp = compilePattern(searchStr);

    // Search for all entities matching query
    Index
        .keys(Index.PACKAGES)
        .sort()
        .forEach(function(elem) { searchPackage(elem, regExp); })
}

function isMobile() {
    return /Android|webOS|Mobi|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
