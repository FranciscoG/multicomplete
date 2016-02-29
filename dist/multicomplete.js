(function(){
  'use strict';

  function PreviewHandler(options){
    if (!(this instanceof PreviewHandler)) {
      return new PreviewHandler(options);
    }

    /**
     * Default options
     * @type {Object}
     */
    var defaults = {
      output: null, // will be required 
      input: null, // will be required 
      outputDom : "li",
      activeClass : "active",
      beforeReplace: null,
      getActiveText : null,
      outputTemplate : null
    };

    /**
     * merge options and defaults where user options will
     * override internal defaults
     * @type {Object}
     */
    this.opts = $.extend(true, {}, defaults, options);

    /**
     * Caching jQuery selectors and checking for 
     * required options
     */
    
    this.$input = $(this.opts.input);
    if (!this.opts.input || !this.$input.length) {
      this.warn("input option not provided or element is missing");
      return;
    }
    
    this.$output = $(this.opts.output);
    if (!this.opts.output || !this.$output.length) {
      this.warn("preview container not provided or element is missing");
      return;
    }
    
    /**
     * Caching important DOM nodes when we need to use
     * straight up Javascript instead of jQuery
     * @type {[type]}
     */
    this.inputNode = this.$input.get(0);
    this.outputNode = this.$output.get(0);
    this.outputNode.tabIndex = 0;

    this.keys = {
      up        : 38,
      down      : 40,
      left      : 37,
      right     : 39,
      enter     : 13,
      esc       : 27,
      tab       : 9,
      shiftKey  : 16,
      backspace : 8,
      del       : 46,
      space     : 32,
      ctrl      : 17,
    };

    this.states = {
      isPreviewing : false,
      inputHasFocus: false
    };

    this.modKeys = {
      ctrlDown : false,
      shiftDown : false
    };

    this.$input.on('keydown', $.proxy(this.onInputKeydown, this));

    $(document).on('keyup', $.proxy(this.modifierKeysUp, this));
    $(document).on('keydown', $.proxy(this.modifierKeysDown, this));

    this.$output.on('click', this.opts.outputDom, $.proxy(this.onClickPick, this));
    this.$output.on('keyup', $.proxy(this.outputKeyup, this));

  }

  PreviewHandler.prototype = {
    
    warn: function(stuff){
      if (console && console.warn) { console.warn("mutlicomplete:",stuff) ;}
    },

    modifierKeysDown: function(e) {
      if (e.keyCode === this.keys.ctrl) {
        this.modKeys.ctrlDown = true;
      }
      if (e.keyCode === this.keys.shiftKey) {
        this.modKeys.shiftKey = true;
      }
    },

    modifierKeysUp : function (e) {
      if (e.keyCode === this.keys.ctrl) {
        this.modKeys.ctrlDown = false;
      }
      if (e.keyCode === this.keys.shiftKey) {
        this.modKeys.shiftKey = false;
      }
    },

    outputKeyup: function(e){
      this.states.inputHasFocus = false;
      return this.handleKeys(e);
    },

    onInputKeydown: function(e){
      this.states.inputHasFocus = true;
      return this.handleKeys(e);
    },

    handleKeys: function(e) {
      switch (e.keyCode) {
        case this.keys.up:
          if (this.states.isPreviewing) {
            this.navPreview(-1);
            e.preventDefault();
            return false;
          }
          break;
        case this.keys.down:
          if (this.states.isPreviewing) {
            this.navPreview(1);
            e.preventDefault();
            return false;
          }
          break;
        case this.keys.right:
          if (this.modKeys.ctrlDown || this.modKeys.shiftDown || e.shiftKey || e.ctrlKey) {
              return true;
          }
          if (this.states.isPreviewing) {
            this.useActiveText();
            this.clearPreview();
            e.preventDefault();
            return false;
          }
          break;
        case this.keys.enter:
          if (this.states.isPreviewing) {
            this.useActiveText();
            this.clearPreview();
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
          }
          break;
        case this.keys.tab:
          if (this.states.isPreviewing) {
            this.useActiveText();
            this.clearPreview();

            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
          }
          break;
        default:
          this.states.isPreviewing = false;
          return true;
      }
      return true;
    },

    clearPreview: function() {
      this.$output.empty();
      this.$output.hide();
      this.states.isPreviewing = false;
    },

    addToPreview: function(filteredData) {
      this.clearPreview();
      this.states.isPreviewing = true;
      var self = this;

      var tmpFrag = document.createDocumentFragment();
      $.each(filteredData, function(i, el){
        var item = document.createElement(self.opts.outputDom);
        
        if (typeof self.opts.outputTemplate === 'function') {
          item.innerHTML = self.opts.outputTemplate(self.info.activeMarker, el);
        } else {
          item.textContent = el;
        }
        
        if (i === 0) { item.classList.add(self.opts.activeClass); }

        item.tabIndex = 0;
        tmpFrag.appendChild(item);
      });

      this.$output.append(tmpFrag).slideDown(200);
      this.$collection = this.$output.children();
    },

    navPreview: function(incrementBy) {
      var activeIndex = this.$output.find('.' + this.opts.activeClass).index();
      var newItem = activeIndex + incrementBy;

      var childLen = this.$collection.length;
      if (newItem < 0) {
        newItem = childLen - 1;
      } else if (newItem > childLen - 1) {
        newItem = 0;
      }

      this.$collection.removeClass(this.opts.activeClass).eq(newItem).addClass(this.opts.activeClass);
      this.useActiveText();
    },

    // probably should rename this to differ from the option
    getActiveText: function(andScroll){
      var $newActive = this.$output.find('.' + this.opts.activeClass);
      if (andScroll) {
        this.scrollOutput($newActive);
      }
      var newText;
      if (typeof this.opts.getActiveText === "function") {
        newText = this.opts.getActiveText($newActive);
      } else {
        newText = $newActive.text();
      }
      return newText;
    },

    useActiveText: function(){
      var newText = this.getActiveText(true);
      this.replaceInPlace(newText);
    },

    onClickPick: function(e){
      var newText;
      if (typeof this.opts.getActiveText === "function") {
        newText = this.opts.getActiveText($(e.target));
      } else {
        newText = $(e.target).text();
      }
      
      this.replaceInPlace(newText);
      this.clearPreview();
    },

    scrollOutput: function($elem){
      if ($elem.length) {
        $elem.get(0).scrollIntoView(false);
      }
    },

    replaceInPlace: function(str){
      var val = this.info.val;
      if (typeof this.opts.beforeReplace === 'function') {
        str = this.opts.beforeReplace(this.info.activeMarker, str);
      }
      var newVal = val.slice(0, this.info.start) + str + val.slice(this.info.end, val.length - 1);
      this.info.end = this.info.start + str.length + 1;
      this.$input.val(newVal);
      this.setCursorPosition(this.info.end);
    },

    setCursorPosition: function(pos){
      var range;
      var elem = this.inputNode;
      if (elem.createTextRange) {
          range = elem.createTextRange();
          range.move('character', pos);
          range.select();
      } else {
          elem.focus();
          if (elem.selectionStart !== undefined) {
              elem.setSelectionRange(pos, pos);
          }
      }
      this.states.inputHasFocus = true;
    }

  };

  /* global define */
  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      return define([], factory);
    } else if (typeof module === 'object' && module.exports) {
      return module.exports = factory();
    } else {
      return root.PreviewHandler = factory();
    }
  })(this, function() {
    return PreviewHandler;
  });


}).call(this);
(function(){
  'use strict';

  /* global jQuery */
  function MultiComplete(options){

    if (!(this instanceof MultiComplete)) {
      return new MultiComplete(options);
    }

    /**
     * Default options
     * @type {Object}
     */
    var defaults = {
      input: null, // will be required 
      fuzzyFilter : true
    };

    /**
     * merge options and defaults where user options will
     * override internal defaults
     * @type {Object}
     */
    this.opts = $.extend(true, {}, defaults, options);

    /**
     * Caching jQuery selectors and checking for 
     * required options
     */
    
    this.$input = $(this.opts.input);
    if (!this.opts.input || !this.$input.length) {
      this.warn("input option not provided or element is missing");
      return;
    }
    
    
    if (!this.opts.datasets) {
      this.warn("datasets missing");
      return;
    }

    var markers = "";
    for (var key in this.opts.datasets) {
      markers += key;
    }
    this.markersRegex = new RegExp("["+markers+"]", "i");

    /**
     * Caching important DOM nodes when we need to use
     * straight up Javascript instead of jQuery
     * @type {[type]}
     */
    this.inputNode = this.$input.get(0);

    this.info = {
      filteredDataLength: 0
    };
    
    this.$input.on('keyup', $.proxy(this.onInputKeyup, this));
  }

  MultiComplete.prototype = {
    
    warn: function(stuff){
      if (console && console.warn) { console.warn("mutlicomplete:",stuff) ;}
    },

    getNextSpace: function(str, start) {
      var returnIndex = str.substring(start, str.length).indexOf(' ');
      return (returnIndex < 0)? str.length : returnIndex + start;
    },

    getPrevSpace: function(str, end) {
      var returnIndex =  str.substring(0, end).lastIndexOf(' ');
      return returnIndex < 0 ? 0 : returnIndex + 1;
    },

    findPositions: function(val, cursorPos) {
      var startIndex;
      var endIndex;

      if (val[cursorPos] === " ") {
        endIndex = cursorPos;
      } else {
        endIndex = this.getNextSpace(val, cursorPos);
      }

      var leftChar = val[cursorPos - 1];
      if (leftChar === " ") {
        startIndex = cursorPos;
      } else {
        startIndex = this.getPrevSpace(val, cursorPos);
      }
      return [startIndex, endIndex];
    },

    onInputKeyup : function(evt) {
      var val = this.inputNode.value;
      
      if (val) {
        var cursorPos = this.inputNode.selectionStart;
        var currentIndexes = this.findPositions(val, cursorPos);
        var currentWord = val.substring(currentIndexes[0],currentIndexes[1]);

        this.info = {
          start: currentIndexes[0], 
          end: currentIndexes[1],
          cursorPos: cursorPos,
          fullStr: currentWord,
          filterStr : currentWord.substr(1),
          val: val
        };
        // console.log(this.info);

        var firstCharOfWord = currentWord.charAt(0);
        if (this.markersRegex.test(firstCharOfWord)) {
          this.info.activeMarker = firstCharOfWord;
          this.beginFiltering(firstCharOfWord, currentWord.substr(1));
        } else {
          this.clearPreview();
        }

        return;
      }

      // if (!val || !this.info.activeMarker) {
      //   this.clearPreview();
      // }
    },


    beginFiltering: function(marker, filterStr){
      if (!this.opts.datasets[marker]) {
        return; 
      }

      var dataToFilter = this.opts.datasets[marker];
      var filteredData = this.getFilteredData(filterStr, this.opts.fuzzyFilter, dataToFilter);
      this.info.filteredDataLength = filteredData.length;

      this.sendToPreview(filteredData);
    },

    getFilteredData: function(filterStr, fuzzyFilter, fullArray) {
      return $.grep(fullArray, function(el){
        if (fuzzyFilter === true) {
          return el.indexOf(filterStr) >= 0;
        } else {
          return el.indexOf(filterStr) === 0;
        }
      });
    },

    sendToPreview: function(x) {
      console.log(x, this.info);
    }

  };

  /* global define */
  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      return define([], factory);
    } else if (typeof module === 'object' && module.exports) {
      return module.exports = factory();
    } else {
      return root.MultiComplete = factory();
    }
  })(this, function() {
    return MultiComplete;
  });

}).call(this);