/*
	jTippy
	https://github.com/HTMLGuyLLC/jTippy
	Made with love by HTMLGuy, LLC
	https://htmlguy.com
	MIT Licensed
*/
;(function($) {

    $.fn.jTippy = function(options) {

        //Instantiate jTippy once per dom element
        if (this.length > 1){
            this.each(function() {
                $(this).jTippy(options);
            });
            return this;
        }

        //if there's nothing being passed
        if( typeof this === 'undefined' || this.length !== 1 )
        {
            return false;
        }

        const dom_wrapped = $(this);

        //get list of options
        options = $.extend({}, $.jTippy.defaults, options, dom_wrapped.data());

        //get title attribute
        let title = dom_wrapped.attr('title');

        //if exists, override defaults
        if( typeof title !== 'undefined' && title.length )
        {
            options.title = title;
        }

        //add theme class
        options.class += ' jt-'+options.theme+'-theme';
        //add size class
        options.class += ' jt-'+options.size;

        //if toggle on hover, no backdrop
        if( options.trigger !== 'click' )
        {
            options.backdrop = false;
        }

        //lowercase and trim whatever trigger is provided to try to make it more forgiving (this means "Hover " works just as well as "hover")
        options.trigger = options.trigger.toLowerCase().trim();

        let helper = {
            dom: this,
            dom_wrapped: dom_wrapped,
            position_debug: options.position_debug,
            trigger: options.trigger,
            title: options.title,
            theme: options.theme,
            class: options.class,
            backdrop: options.backdrop,
            position: options.position,
            close_on_outside_click: options.close_on_outside_click,
            singleton: options.singleton,
            dataAttr: 'jTippy',
            //create tooltip html
            createTooltipHTML: function(){
                return `<div class='jtippy ${helper.class}' role='tooltip'><div class='jt-arrow'></div><div class='jt-title'>${helper.title}</div></div>`;
            },
            //creates backdrop html if necessary
            createBackdropHTML: function(){
                return helper.backdrop ? `<div class='jt-backdrop jt-${helper.backdrop}-backdrop'></div>` : false;
            },
            //disable existing options/handlers
            destroy: function(){
                //only if it's actually tied to this element
                const existing = helper.dom_wrapped.data(helper.dataAttr);
                if( typeof existing !== 'undefined' && existing !== null ) {
                    if( existing.trigger === 'click' )
                    {
                        //disable handler
                        existing.dom_wrapped.off('touchstart mousedown', existing.toggleTooltipHandler);
                        existing.dom_wrapped.off('click', existing.preventDefaultHandler);
                    }
                    else if( existing.trigger === 'focus' )
                    {
                        existing.dom_wrapped.off('touchstart focus', existing.show);
                        existing.dom_wrapped.off('touchend blur', existing.hide);
                    }
                    else if( existing.trigger === 'hover' )
                    {
                        existing.dom_wrapped.off('touchstart mouseenter', existing.show);
                        existing.dom_wrapped.off('touchend mouseleave', existing.hide);
                    }
                    else if( existing.trigger === 'hoverfocus' )
                    {
                        existing.dom_wrapped.off('focus', existing.hoverfocusFocusShow);
                        existing.dom_wrapped.off('blur', existing.hoverfocusBlur);

                        existing.dom_wrapped.off('touchstart mouseenter', existing.show);
                        existing.dom_wrapped.off('touchend mouseleave', existing.hoverfocusHide);
                    }

                    //attach resize handler to reposition tooltip
                    $(window).off('resize', existing.onResize);

                    //if currently shown, hide it
                    existing.isVisible() && existing.hide();

                    //detach from dom
                    existing.dom_wrapped.data(existing.dataAttr, null);
                }
            },
            //initialize the plugin on this element
            initialize: function() {
                //attach on handler to show tooltip
                //use touchstart and mousedown just like if you click outside the tooltip to close it
                //this way it blocks the hide if you click the button a second time to close the tooltip
                if( helper.trigger === 'click' )
                {
                    helper.dom_wrapped.on('touchstart mousedown', helper.toggleTooltipHandler);
                    helper.dom_wrapped.on('click', helper.preventDefaultHandler);
                }
                else if( helper.trigger === 'focus' )
                {
                    helper.dom_wrapped.on('touchstart focus', helper.show);
                    helper.dom_wrapped.on('touchend blur', helper.hide);
                }
                else if( helper.trigger === 'hover' )
                {
                    helper.dom_wrapped.on('touchstart mouseenter', helper.show);
                    helper.dom_wrapped.on('touchend mouseleave', helper.hide);
                }
                else if( helper.trigger === 'hoverfocus' )
                {
                    helper.dom_wrapped.on('focus', helper.hoverfocusFocusShow);
                    helper.dom_wrapped.on('blur', helper.hoverfocusBlur);

                    helper.dom_wrapped.on('touchstart mouseenter', helper.show);
                    helper.dom_wrapped.on('touchend mouseleave', helper.hoverfocusHide);
                }

                //hide on click if not click
                if( helper.trigger !== 'click' ) {
                    helper.dom_wrapped.on('touchstart mousedown', helper.hide);
                }

                if( !$.jTippy.body_click_initialized )
                {
                    $(document).on('touchstart mousedown', helper.onClickOutside);
                    $.jTippy.bodyClickInitialized = true;
                }

                //attach to dom for easy access later
                helper.dom_wrapped.data(helper.dataAttr, helper);

                //return dom for chaining of event handlers and such
                return helper.dom;
            },
            //add class when focused for hoverfocus - this way mouseleave can detect if focused or not
            //document.activeElement isn't working to detect focus
            hoverfocusFocusShow: function(){
                helper.dom_wrapped.addClass('jt-focused');
                helper.dom_wrapped.show();
            },
            //remove class on blur for hoverfocus
            hoverfocusBlur: function(){
                if( helper.dom_wrapped && helper.dom_wrapped.length ) {
                    helper.dom_wrapped.removeClass('jt-focused');
                }
                helper.hide();
            },
            //prevent hiding a tooltip on mouseleave if the element is still focused
            hoverfocusHide: function(){
                //don't hide if focused. Hide on blur instead.
                if( helper.dom_wrapped.hasClass('jt-focused') )
                {
                    return false;
                }
                helper.hide();
            },
            //on click of element, prevent default
            preventDefaultHandler: function(e){
                e.preventDefault();
                return false;
            },
            //toggle tooltip visibility (used for click event)
            toggleTooltipHandler: function(e){
                e.preventDefault();
                helper.isVisible() && helper.hide() || helper.show();
                return false;
            },
            //shows the tooltip
            show: function(trigger_event){
                //if already visible, don't show
                if( helper.isVisible() )
                {
                    return false;
                }

                if( helper.singleton )
                {
                    helper.hideAllVisible();
                }

                //cache reference to the body
                const body = $('body');

                //blurred won't work like the standard separate div backdrop
                //it has to be applied directly to the dom we're blurring
                if( helper.backdrop === 'blurred' )
                {
                    body.addClass('jt-blurred-body');
                }
                //if regular backdrop, append the div
                else if( helper.backdrop )
                {
                    body.append(helper.createBackdropHTML());
                }
                //add the tooltip to the dom
                body.append(helper.createTooltipHTML());
                //cache tooltip
                helper.tooltip = $('.jtippy:last');
                //position it
                helper.positionTooltip();
                //attach resize handler to reposition tooltip
                $(window).on('resize', helper.onResize);
                //give the tooltip an id so we can set accessibility props
                const id = 'jTippy'+Date.now();
                helper.tooltip.attr('id', id);
                helper.dom.attr('aria-describedby', id);
                //add to open array
                $.jTippy.visible.push(helper);
                //trigger event on show and pass the tooltip
                if( typeof trigger_event === 'undefined' || trigger_event ) {
                    helper.dom.trigger('jt-show', {
                        'tooltip': helper.tooltip
                    });
                }
            },
            //is this tooltip visible
            isVisible: function(){
                return $.inArray(helper, $.jTippy.visible) > -1;
            },
            //hide all visible tooltips
            hideAllVisible: function(){
                $.each($.jTippy.visible, function(index, jTippy){
                    jTippy.hide();
                });
                return this;
            },
            //hides the tooltip for this element
            hide: function(trigger_event){
                //remove scroll handler to reposition tooltip
                $(window).off('resize', helper.onResize);
                //remove accessbility props
                helper.dom.attr('aria-describedby', null);
                //remove from dom
                if( helper.tooltip && helper.tooltip.length ) {
                    helper.tooltip.remove();
                }
                //remove blurring to body
                if( helper.backdrop === 'blurred' )
                {
                    $('body').removeClass('jt-blurred-body');
                }
                //remove backdrop
                else if( helper.backdrop )
                {
                    $('.jt-backdrop').remove();
                }
                //trigger hide event
                if( typeof trigger_event === 'undefined' || trigger_event ) {
                    helper.dom.trigger('jt-hide');
                }
                //hide on click if not click
                if( helper.trigger !== 'click' ) {
                    helper.dom_wrapped.off('touchstart mousedown', helper.hide);
                }
                //remove from open array
                var index = $.inArray(helper, $.jTippy.visible);
                $.jTippy.visible.splice(index, 1);

                return helper.dom;
            },
            //on body resized
            onResize: function(){
                //hiding and showing the tooltip will update it's position
                helper.hide(false);
                helper.show(false);
            },
            //on click outside of the tooltip
            onClickOutside: function(e){
                const target = $(e.target);
                if( !target.hasClass('jtippy') && !target.parents('.jtippy:first').length )
                {
                    $.each($.jTippy.visible, function(index, helper){
                        if( typeof helper !== 'undefined' ) {
                            if (helper.trigger === 'click' && helper.close_on_outside_click) {
                                helper.hide();
                            }
                        }
                    });
                }
            },
            //position tooltip based on where the clicked element is
            positionTooltip: function(){

                helper.positionDebug('-- Start positioning --');

                //cache reference to arrow
                let arrow = helper.tooltip.find('.jt-arrow');

                //first try to fit it with the preferred position
                let [arrow_dir, elem_width, tooltip_width, tooltip_height, left, top] = helper.calculateSafePosition(helper.position);

                //if still couldn't fit, switch to auto
                if( typeof left === 'undefined' && helper.position !== 'auto' )
                {
                    helper.positionDebug('Couldn\'t fit preferred position');
                    [arrow_dir, elem_width, tooltip_width, tooltip_height, left, top] = helper.calculateSafePosition('auto');
                }

                //fallback to centered (modal style)
                if( typeof left === 'undefined' )
                {
                    helper.positionDebug('Doesn\'t appear to fit. Displaying centered');
                    helper.tooltip.addClass('jt-centered').css({
                        'top': '50%',
                        'left': '50%',
                        'margin-left': -(tooltip_width / 2),
                        'margin-top': -(tooltip_height / 2)
                    });
                    if( arrow && arrow.length ) {
                        arrow.remove();
                    }
                    helper.positionDebug('-- Done positioning --');
                    return;
                }

                //position the tooltip
                helper.positionDebug({'Setting Position':{'Left':left,'Top':top}});
                helper.tooltip.css('left', left);
                helper.tooltip.css('top', top);

                //arrow won't point at it if hugging side
                if( elem_width < 60 )
                {
                    helper.positionDebug('Element is less than '+elem_width+'px. Setting arrow to hug the side tighter');
                    arrow_dir += ' jt-arrow-super-hug';
                }

                //set the arrow location
                arrow.addClass('jt-arrow-'+arrow_dir);

                helper.positionDebug('-- Done positioning --');

                return helper;
            },
            //detects where it will fit and returns the positioning info
            calculateSafePosition: function(position)
            {
                //cache reference to arrow
                let arrow = helper.tooltip.find('.jt-arrow');

                //get position + size of clicked element
                let elem_position = helper.dom_wrapped.offset();
                let elem_height = helper.dom_wrapped.outerHeight();
                let elem_width = helper.dom_wrapped.outerWidth();

                //get tooltip dimensions
                let tooltip_width = helper.tooltip.outerWidth();
                let tooltip_height = helper.tooltip.outerHeight();

                //get window dimensions
                let window_width = document.querySelector('body').offsetWidth;
                let window_height = document.querySelector('body').offsetHeight;

                //get arrow size so we can pad
                let arrow_height = arrow.is(":visible") ? arrow.outerHeight() : 0;
                let arrow_width = arrow.is(":visible") ? arrow.outerWidth() : 0;

                //see where it fits in relation to the clicked element
                let fits = {};
                fits.below = (window_height - (tooltip_height+elem_height+elem_position.top)) > 5;
                fits.above = (elem_position.top - tooltip_height) > 5;
                fits.vertical_half = (elem_position.top + (elem_width/2) - (tooltip_height/2)) > 5;
                fits.right = (window_width - (tooltip_width+elem_width+elem_position.left)) > 5;
                fits.right_half = (window_width - elem_position.left - (elem_width/2) - (tooltip_width/2)) > 5;
                fits.right_full = (window_width - elem_position.left - tooltip_width) > 5;
                fits.left = (elem_position.left - tooltip_width) > 5;
                fits.left_half = (elem_position.left + (elem_width/2) - (tooltip_width/2)) > 5;
                fits.left_full = (elem_position.left - tooltip_width) > 5;

                //in debug mode, display all details
                helper.positionDebug({
                    'Clicked Element': {'Left': elem_position.left, 'Top': elem_position.top},
                });
                helper.positionDebug({
                    'Element Dimensions':{'Height':elem_height, 'Width':elem_width},
                    'Tooltip Dimensions':{'Height':tooltip_height, 'Width':tooltip_width},
                    'Window Dimensions':{'Height':window_height, 'Width':window_width},
                    'Arrow Dimensions':{'Height':arrow_height, 'Width':arrow_width},
                });
                helper.positionDebug(fits);

                //vars we need for positioning
                let arrow_dir, left, top;

                if( (position === 'auto' || position === 'bottom') && fits.below && fits.left_half && fits.right_half )
                {
                    helper.positionDebug('Displaying below, centered');
                    arrow_dir = 'top';
                    left = elem_position.left - (tooltip_width/2) + (elem_width/2);
                    top = elem_position.top + elem_height + (arrow_height/2);
                }
                else if( (position === 'auto' || position === 'top') && fits.above && fits.left_half && fits.right_half )
                {
                    helper.positionDebug('Displaying above, centered');
                    arrow_dir = 'bottom';
                    left = elem_position.left - (tooltip_width/2) + (elem_width/2);
                    top = elem_position.top - tooltip_height - (arrow_height/2);
                }
                else if( (position === 'auto' || position === 'left') && fits.left && fits.vertical_half )
                {
                    helper.positionDebug('Displaying left, centered');
                    arrow_dir = 'right';
                    left = elem_position.left - tooltip_width - (arrow_width/2);
                    top = elem_position.top + (elem_height/2) - (tooltip_height/2);
                }
                else if( (position === 'auto' || position === 'right') && fits.right && fits.vertical_half )
                {
                    helper.positionDebug('Displaying right, centered');
                    arrow_dir = 'left';
                    left = elem_position.left + elem_width + (arrow_width/2);
                    top = elem_position.top + (elem_height/2) - (tooltip_height/2);
                }
                else if( (position === 'auto' || position === 'bottom') && fits.below && fits.right_full )
                {
                    helper.positionDebug('Displaying below, to the right');
                    arrow_dir = 'top jt-arrow-hug-left';
                    left = elem_position.left;
                    top = elem_position.top + elem_height + (arrow_height/2);
                }
                else if( (position === 'auto' || position === 'bottom') && fits.below && fits.left_full )
                {
                    helper.positionDebug('Displaying below, to the left');
                    arrow_dir = 'top jt-arrow-hug-right';
                    left = elem_position.left + elem_width - tooltip_width;
                    top = elem_position.top + elem_height + (arrow_height/2);
                }
                else if( (position === 'auto' || position === 'top') && fits.above && fits.right_full )
                {
                    helper.positionDebug('Displaying above, to the right');
                    arrow_dir = 'bottom jt-arrow-hug-left';
                    left = elem_position.left;
                    top = elem_position.top - tooltip_height - (arrow_height/2);
                }
                else if( (position === 'auto' || position === 'top') && fits.above && fits.left_full )
                {
                    helper.positionDebug('Displaying above, to the left');
                    arrow_dir = 'bottom jt-arrow-hug-right';
                    left = elem_position.left + elem_width - tooltip_width;
                    top = elem_position.top - tooltip_height - (arrow_height/2);
                }

                return [arrow_dir, elem_width, tooltip_width, tooltip_height, left, top];
            },
            //if position_debug is enabled, let's console.log the details
            positionDebug: function(msg){
                if( !helper.position_debug ) {
                    return false;
                }

                return typeof msg === 'object' ? console.table(msg) : console.log(`Position: ${msg}`);
            }
        };

        helper.destroy();

        return helper.initialize();
    };

    $.jTippy = {};
    $.jTippy.visible = [];
    $.jTippy.body_click_initialized = false;
    $.jTippy.defaults = {
        title: '',
        trigger: 'hoverfocus',
        position: 'auto',
        class: '',
        theme: 'black',
        size: 'small',
        backdrop: false,
        singleton: true,
        close_on_outside_click: true,
    }

})(jQuery);